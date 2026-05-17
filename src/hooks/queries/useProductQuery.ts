import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

export function useProductQuery(productId: string, includeOwnerRequests: boolean = false) {
  const cachedProduct = useAppDataStore((state) => (productId ? state.productsById[productId] ?? null : null));
  const upsertProduct = useAppDataStore((state) => state.upsertProduct);

  const query = useQuery({
    queryKey: [...queryKeys.products.detail(productId), includeOwnerRequests],
    queryFn: async () => {
      const envelope = await mobileApiClient.getProductById(productId, includeOwnerRequests);
      return envelope.data ?? null;
    },
    enabled: Boolean(productId),
    initialData: cachedProduct ?? undefined,
    initialDataUpdatedAt: cachedProduct ? new Date(cachedProduct.updatedAt).getTime() : undefined,
    staleTime: 5 * 60 * 1000,
  });

  useSyncEntity(query.data, upsertProduct);

  return query;
}
