import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntity } from "@/lib/store/useStoreSync";

export function useProductQuery(productId: string) {
  const upsertProduct = useAppDataStore((state) => state.upsertProduct);

  const query = useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: async () => {
      const envelope = await mobileApiClient.getProductById(productId);
      return envelope.data ?? null;
    },
    enabled: Boolean(productId),
  });

  useSyncEntity(query.data, upsertProduct);

  return query;
}
