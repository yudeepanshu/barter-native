import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { NotificationsQueryInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntityList, useSyncValue } from "@/lib/store/useStoreSync";

export function useNotificationsQuery(filters: Omit<NotificationsQueryInput, "cursor">) {
  const upsertNotifications = useAppDataStore((state) => state.upsertNotifications);
  const setNotificationsUnreadCount = useAppDataStore(
    (state) => state.setNotificationsUnreadCount,
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.notifications.infinite(filters),
    queryFn: async ({ pageParam }) => {
      const envelope = await mobileApiClient.getNotifications({
        ...filters,
        cursor: pageParam ?? undefined,
      });

      return envelope.data ?? { items: [], nextCursor: null, hasMore: false, unreadCount: 0 };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;

  useSyncEntityList(items, upsertNotifications);
  useSyncValue(unreadCount, setNotificationsUnreadCount);

  return query;
}