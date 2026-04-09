import { useQuery } from "@tanstack/react-query";
import type { TransactionSummary } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

export function useActiveTransactionQuery(requestId: string, enabled = true) {
  const upsertTransaction = useAppDataStore((state) => state.upsertTransaction);
  const queryKey = queryKeys.transactions.activeByRequest(requestId);

  const query = useQuery<
    TransactionSummary | null,
    Error,
    TransactionSummary | null,
    typeof queryKey
  >({
    queryKey,
    queryFn: async () => {
      const envelope = await mobileApiClient.getActiveTransaction({ requestId });
      return envelope.data ?? null;
    },
    enabled: enabled && Boolean(requestId),
    retry: false,
  });

  useSyncEntity(query.data, upsertTransaction);

  return query;
}
