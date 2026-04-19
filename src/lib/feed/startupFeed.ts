import { queryClient } from "@/lib/query/queryClient";
import { queryKeys } from "@/lib/query/queryKeys";
import { mobileApiClient } from "@/lib/api/client";
import { writeStartupFeedSnapshot } from "@/lib/feed/feedSnapshotCache";

export const STARTUP_FEED_LIMIT = 20;
export const STARTUP_SENT_REQUESTS_LIMIT = 100;

export function getStartupFeedFilters(userId: string) {
  return {
    limit: STARTUP_FEED_LIMIT,
    excludeOwnerId: userId,
  };
}

export async function prefetchStartupFeed(userId: string) {
  const filters = getStartupFeedFilters(userId);

  const data = await queryClient.fetchInfiniteQuery({
    queryKey: queryKeys.products.infinite(filters),
    queryFn: async ({ pageParam }) => {
      const envelope = await mobileApiClient.getProducts({
        ...filters,
        cursor: pageParam ?? undefined,
      });
      return envelope.data ?? { items: [], nextCursor: null, hasMore: false };
    },
    initialPageParam: null as string | null,
  });

  const firstPageItems = data.pages[0]?.items ?? [];
  if (firstPageItems.length > 0) {
    void writeStartupFeedSnapshot(userId, firstPageItems);
  }
}

export async function prefetchStartupAuxData() {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.categories.all,
      queryFn: async () => {
        const envelope = await mobileApiClient.getCategories();
        return envelope.data ?? [];
      },
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.requests.sentInfinite({ limit: STARTUP_SENT_REQUESTS_LIMIT }),
      queryFn: async ({ pageParam }) => {
        const envelope = await mobileApiClient.getSentRequests({
          limit: STARTUP_SENT_REQUESTS_LIMIT,
          cursor: pageParam ?? undefined,
        });
        return envelope.data ?? { items: [], nextCursor: null, hasMore: false };
      },
      initialPageParam: null as string | null,
    }),
  ]);
}