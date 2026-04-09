import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { RequestListQueryInput, RequestsListResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntityList } from "@/lib/store/useStoreSync";

export type RequestsScope = "sent" | "received";

interface UseRequestsQueryOptions {
  enabled?: boolean;
}

export function useRequestsQuery(
  scope: RequestsScope,
  filters: Omit<RequestListQueryInput, "cursor">,
  options: UseRequestsQueryOptions = {},
): UseInfiniteQueryResult<InfiniteData<RequestsListResult>, Error> {
  const { enabled = true } = options;
  const upsertRequests = useAppDataStore((state) => state.upsertRequests);
  const queryKey =
    scope === "sent"
      ? queryKeys.requests.sentInfinite(filters)
      : queryKeys.requests.receivedInfinite(filters);

  const query = useInfiniteQuery<
    RequestsListResult,
    Error,
    InfiniteData<RequestsListResult>,
    typeof queryKey,
    string | null
  >({
    queryKey,
    enabled,
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

  const requests = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  useSyncEntityList(requests, upsertRequests);

  return query;
}
