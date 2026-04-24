import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import type { NotificationSummary, NotificationsListResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { invalidateNotifications } from "@/lib/query/mutationSync";
import { useAppStore } from "@/lib/store/appStore";

type NotificationsInfiniteData = InfiniteData<NotificationsListResult, string | null>;

type NotificationsMutationContext = {
  previousQueries: Array<[QueryKey, NotificationsInfiniteData | undefined]>;
  previousStore: {
    notificationsById: Record<string, NotificationSummary>;
    notificationsUnreadCount: number;
  };
};

function getNotificationsMutationContext(
  queryClient: ReturnType<typeof useQueryClient>,
): NotificationsMutationContext {
  const store = useAppStore.getState();

  return {
    previousQueries: queryClient.getQueriesData<NotificationsInfiniteData>({
      queryKey: ["notifications", "infinite"],
    }),
    previousStore: {
      notificationsById: store.notificationsById,
      notificationsUnreadCount: store.notificationsUnreadCount,
    },
  };
}

function restoreNotificationsMutationContext(
  queryClient: ReturnType<typeof useQueryClient>,
  context?: NotificationsMutationContext,
) {
  if (!context) {
    return;
  }

  context.previousQueries.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });

  useAppStore.setState({
    notificationsById: context.previousStore.notificationsById,
    notificationsUnreadCount: context.previousStore.notificationsUnreadCount,
  });
}

function patchNotificationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (data: NotificationsInfiniteData | undefined) => NotificationsInfiniteData | undefined,
) {
  queryClient.setQueriesData<NotificationsInfiniteData>(
    { queryKey: ["notifications", "infinite"] },
    updater,
  );
}

function markNotificationReadInData(
  data: NotificationsInfiniteData | undefined,
  notificationId: string,
  timestamp: string,
) {
  if (!data) {
    return data;
  }

  let unreadDelta = 0;
  let changed = false;

  const pages = data.pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (item.id !== notificationId || item.isRead) {
        return item;
      }

      unreadDelta -= 1;
      changed = true;
      pageChanged = true;

      return {
        ...item,
        isRead: true,
        readAt: timestamp,
        updatedAt: timestamp,
      };
    });

    return pageChanged ? { ...page, items } : page;
  });

  if (!changed) {
    return data;
  }

  return {
    ...data,
    pages: pages.map((page, index) =>
      index === 0
        ? { ...page, unreadCount: Math.max(0, page.unreadCount + unreadDelta) }
        : page,
    ),
  };
}

function markAllNotificationsReadInData(data: NotificationsInfiniteData | undefined, timestamp: string) {
  if (!data) {
    return data;
  }

  let changed = false;

  return {
    ...data,
    pages: data.pages.map((page, index) => {
      const items = page.items.map((item) => {
        if (item.isRead) {
          return item;
        }

        changed = true;
        return {
          ...item,
          isRead: true,
          readAt: timestamp,
          updatedAt: timestamp,
        };
      });

      return {
        ...page,
        items,
        unreadCount: index === 0 ? 0 : page.unreadCount,
      };
    }),
  } satisfies NotificationsInfiniteData;
}

function clearAllNotificationsInData(data: NotificationsInfiniteData | undefined) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: [],
      unreadCount: index === 0 ? 0 : page.unreadCount,
      hasMore: false,
      nextCursor: null,
    })),
  } satisfies NotificationsInfiniteData;
}

function optimisticallyMarkNotificationRead(notificationId: string, timestamp: string) {
  const store = useAppStore.getState();
  const notification = store.notificationsById[notificationId];

  if (!notification || notification.isRead) {
    return;
  }

  store.patchNotification(notificationId, {
    isRead: true,
    readAt: timestamp,
    updatedAt: timestamp,
  });
  store.setNotificationsUnreadCount(store.notificationsUnreadCount - 1);
}

function optimisticallyMarkAllNotificationsRead(timestamp: string) {
  useAppStore.setState((state) => ({
    notificationsById: Object.fromEntries(
      Object.entries(state.notificationsById).map(([notificationId, notification]) => [
        notificationId,
        notification.isRead
          ? notification
          : {
              ...notification,
              isRead: true,
              readAt: timestamp,
              updatedAt: timestamp,
            },
      ]),
    ),
    notificationsUnreadCount: 0,
  }));
}

function optimisticallyClearAllNotifications() {
  useAppStore.setState({
    notificationsById: {},
    notificationsUnreadCount: 0,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const envelope = await mobileApiClient.markNotificationRead(notificationId);
      return envelope.data ?? null;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      const context = getNotificationsMutationContext(queryClient);
      const timestamp = new Date().toISOString();

      patchNotificationQueries(queryClient, (data) =>
        markNotificationReadInData(data, notificationId, timestamp),
      );
      optimisticallyMarkNotificationRead(notificationId, timestamp);

      return context;
    },
    onError: (_error, _notificationId, context) => {
      restoreNotificationsMutationContext(queryClient, context);
    },
    onSuccess: (result) => {
      if (typeof result?.unreadCount === "number") {
        useAppStore.getState().setNotificationsUnreadCount(result.unreadCount);
      }
    },
    onSettled: () => {
      void invalidateNotifications(queryClient);
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const envelope = await mobileApiClient.markAllNotificationsRead();
      return envelope.data ?? null;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      const context = getNotificationsMutationContext(queryClient);
      const timestamp = new Date().toISOString();

      patchNotificationQueries(queryClient, (data) => markAllNotificationsReadInData(data, timestamp));
      optimisticallyMarkAllNotificationsRead(timestamp);

      return context;
    },
    onError: (_error, _variables, context) => {
      restoreNotificationsMutationContext(queryClient, context);
    },
    onSuccess: (result) => {
      if (typeof result?.unreadCount === "number") {
        useAppStore.getState().setNotificationsUnreadCount(result.unreadCount);
      }
    },
    onSettled: () => {
      void invalidateNotifications(queryClient);
    },
  });
}

export function useClearAllNotificationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const envelope = await mobileApiClient.clearAllNotifications();
      return envelope.data ?? null;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      const context = getNotificationsMutationContext(queryClient);

      patchNotificationQueries(queryClient, clearAllNotificationsInData);
      optimisticallyClearAllNotifications();

      return context;
    },
    onError: (_error, _variables, context) => {
      restoreNotificationsMutationContext(queryClient, context);
    },
    onSettled: () => {
      void invalidateNotifications(queryClient);
    },
  });
}