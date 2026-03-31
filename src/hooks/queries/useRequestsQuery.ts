import { useInfiniteQuery } from "@tanstack/react-query";
import type { RequestListQueryInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export type RequestsScope = "sent" | "received";

export function useRequestsQuery(
  scope: RequestsScope,
  filters: Omit<RequestListQueryInput, "cursor">,
) {
  return useInfiniteQuery({
    queryKey:
      scope === "sent"
        ? queryKeys.requests.sentInfinite(filters)
        : queryKeys.requests.receivedInfinite(filters),
    queryFn: async ({ pageParam }) => {
      const query = { ...filters, cursor: pageParam ?? undefined };
      const envelope =
        scope === "sent"
          ? await mobileApiClient.getSentRequests(query)
          : await mobileApiClient.getReceivedRequests(query);
      return envelope.data ?? { items: [], nextCursor: null, hasMore: false };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
}
