import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { RequestOffersQueryInput, RequestOffersResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

export function useRequestOffersQuery(requestId: string, options?: RequestOffersQueryInput) {
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);
  const queryKey = ["requests", requestId, "offers", options?.order ?? "desc"] as const;

  const query = useQuery<
    RequestOffersResult | null | undefined,
    Error,
    RequestOffersResult | null | undefined,
    typeof queryKey
  >({
    queryKey,
    queryFn: async () => {
      const result = await mobileApiClient.getRequestOffers(requestId, options);
      return result.data;
    },
    enabled: Boolean(requestId),
  });

  const syncOffersResult = useCallback(
    (result: RequestOffersResult) => {
      if (result.requestId && result.offers) {
        upsertOffers(result.requestId, result.offers);
      }
    },
    [upsertOffers],
  );

  useSyncEntity(query.data, syncOffersResult);

  return query;
}
