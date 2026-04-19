import { useQuery } from "@tanstack/react-query";
import type { RequestSummary } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

function hasHydratedRequestDetail(request: RequestSummary | null | undefined): request is RequestSummary {
  if (!request?.product?.owner) {
    return false;
  }

  return request.offers.every(
    (offer) =>
      offer.offeredProducts.every((product) => Boolean(product.product)) &&
      offer.requestedProducts.every((product) => Boolean(product.product)),
  );
}

export function useRequestDetailQuery(requestId: string) {
  const cachedRequest = useAppDataStore((state) =>
    requestId ? state.requestsById[requestId] ?? null : null,
  );
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);
  const queryKey = queryKeys.requests.detail(requestId);
  const initialData = hasHydratedRequestDetail(cachedRequest) ? cachedRequest : undefined;

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
    initialData,
    initialDataUpdatedAt: initialData ? new Date(initialData.updatedAt).getTime() : undefined,
    staleTime: 2 * 60 * 1000,
  });

  useSyncEntity(query.data, upsertRequest);
  useSyncEntity(query.data, (request) => upsertOffers(request.id, request.offers ?? []));

  return query;
}
