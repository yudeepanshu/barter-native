import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useActiveTransactionQuery(requestId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.activeByRequest(requestId),
    queryFn: async () => {
      const envelope = await mobileApiClient.getActiveTransaction({ requestId });
      return envelope.data ?? null;
    },
    enabled: enabled && Boolean(requestId),
    retry: false,
  });
}
