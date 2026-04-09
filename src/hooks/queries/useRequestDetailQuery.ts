import { useQuery } from "@tanstack/react-query";
import type { RequestSummary } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

export function useRequestDetailQuery(requestId: string) {
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const queryKey = queryKeys.requests.detail(requestId);

  const query = useQuery<
    RequestSummary | null | undefined,
    Error,
    RequestSummary | null | undefined,
    typeof queryKey
  >({
    queryKey,
    queryFn: async () => {
      const result = await mobileApiClient.getRequestById(requestId);
      return result.data;
    },
    enabled: Boolean(requestId),
  });

  useSyncEntity(query.data, upsertRequest);

  return query;
}
