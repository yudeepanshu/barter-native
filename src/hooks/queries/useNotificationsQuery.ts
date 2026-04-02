import { useInfiniteQuery } from "@tanstack/react-query";
import type { NotificationsQueryInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useNotificationsQuery(filters: Omit<NotificationsQueryInput, "cursor">) {
  return useInfiniteQuery({
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
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}