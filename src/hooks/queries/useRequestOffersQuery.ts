import { useQuery } from "@tanstack/react-query";
import type { RequestOffersQueryInput, RequestOffersResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { useAppDataStore } from "@/lib/store/appDataStore";

export function useRequestOffersQuery(requestId: string, query?: RequestOffersQueryInput) {
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);
  const queryKey = ["requests", requestId, "offers", query?.order ?? "desc"] as const;

  return useQuery<
    RequestOffersResult | null | undefined,
    Error,
    RequestOffersResult | null | undefined,
    typeof queryKey
  >({
    queryKey,
    queryFn: async () => {
      const result = await mobileApiClient.getRequestOffers(requestId, query);
      return result.data;
    },
    enabled: Boolean(requestId),
    onSuccess: (result) => {
      if (result?.requestId && result.offers) {
        upsertOffers(result.requestId, result.offers);
      }
    },
  });
}
