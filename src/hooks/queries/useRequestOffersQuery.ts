import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { RequestOffersQueryInput, RequestOffersResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

function hasHydratedOffers(offers: RequestOffersResult["offers"] | undefined) {
  if (!offers) {
    return false;
  }

  return offers.every(
    (offer) =>
      offer.offeredProducts.every((product) => Boolean(product.product)) &&
      offer.requestedProducts.every((product) => Boolean(product.product)),
  );
}

function sortOffers(
  offers: RequestOffersResult["offers"],
  order: "asc" | "desc",
) {
  return [...offers].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return order === "asc" ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function useRequestOffersQuery(requestId: string, options?: RequestOffersQueryInput) {
  const cachedRequest = useAppDataStore((state) =>
    requestId ? state.requestsById[requestId] ?? null : null,
  );
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);
  const queryKey = ["requests", requestId, "offers", options?.order ?? "desc"] as const;
  const initialData =
    cachedRequest && hasHydratedOffers(cachedRequest.offers)
      ? {
          requestId: cachedRequest.id,
          currentTurn: cachedRequest.currentTurn,
          status: cachedRequest.status,
          offers: sortOffers(cachedRequest.offers, options?.order ?? "desc"),
        }
      : undefined;

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
    initialData,
    initialDataUpdatedAt: cachedRequest ? new Date(cachedRequest.updatedAt).getTime() : undefined,
    staleTime: 2 * 60 * 1000,
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
