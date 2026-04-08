import { useQuery } from "@tanstack/react-query";
import type { RequestSummary } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

export function useRequestDetailQuery(requestId: string) {
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const queryKey = queryKeys.requests.detail(requestId);

  return useQuery<
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
    onSuccess: (request) => {
      if (request) {
        upsertRequest(request);
      }
    },
  });
}
