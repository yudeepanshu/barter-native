import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { RequestListQueryInput, RequestsListResult } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { mobileApiClient } from "@/lib/api/client";
import { writeStartupSentRequestsSnapshot } from "@/lib/feed/feedSnapshotCache";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntityList } from "@/lib/store/useStoreSync";

export type RequestsScope = "sent" | "received";

interface UseRequestsQueryOptions {
  enabled?: boolean;
}

export const REQUESTS_SHARED_LIMIT = 20;
export const REQUESTS_SENT_MATCH_LIMIT = 100;
export const REQUESTS_STALE_TIME_MS = 60_000;

export function useRequestsQuery(
  scope: RequestsScope,
  filters: Omit<RequestListQueryInput, "cursor">,
  options: UseRequestsQueryOptions = {},
): UseInfiniteQueryResult<InfiniteData<RequestsListResult, string | null>, Error> {
  const { enabled = true } = options;
  const session = useSession();
  const profileId = useAppDataStore((state) => state.profile?.id ?? null);
  const requestsById = useAppDataStore((state) => state.requestsById);
  const upsertRequests = useAppDataStore((state) => state.upsertRequests);
  const queryKey =
    scope === "sent"
      ? queryKeys.requests.sentInfinite(filters)
      : queryKeys.requests.receivedInfinite(filters);

  const initialData = useMemo<InfiniteData<RequestsListResult, string | null> | undefined>(() => {
    if (!profileId || !enabled) {
      return undefined;
    }

    const requestedStatus = filters.status;
    const seededItems = Object.values(requestsById)
      .filter((request) =>
        scope === "sent" ? request.buyerId === profileId : request.sellerId === profileId,
      )
      .filter((request) => (requestedStatus ? request.status === requestedStatus : true))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, filters.limit ?? REQUESTS_SHARED_LIMIT);

    if (seededItems.length === 0) {
      return undefined;
    }

    return {
      pages: [
        {
          items: seededItems,
          nextCursor: null,
          hasMore: seededItems.length >= (filters.limit ?? REQUESTS_SHARED_LIMIT),
        },
      ],
      pageParams: [null],
    };
  }, [enabled, filters.limit, filters.status, profileId, requestsById, scope]);

  const initialDataUpdatedAt = useMemo<number | undefined>(() => {
    if (!initialData) {
      return undefined;
    }

    return 0; // Set to 0 to indicate data is fresh, as it's derived from the store which is the source of truth
  }, [initialData]);

  const query = useInfiniteQuery<
    RequestsListResult,
    Error,
    InfiniteData<RequestsListResult, string | null>,
    typeof queryKey,
    string | null
  >({
    queryKey,
    enabled,
    staleTime: REQUESTS_STALE_TIME_MS,
    initialData,
    initialDataUpdatedAt,
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

  useEffect(() => {
    const userId = session?.user.id;
    if (scope !== "sent" || !userId || requests.length === 0) {
      return;
    }

    void writeStartupSentRequestsSnapshot(userId, requests);
  }, [requests, scope, session?.user.id]);

  return query;
}
