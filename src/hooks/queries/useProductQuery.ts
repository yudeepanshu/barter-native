import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useProductQuery(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: async () => {
      const envelope = await mobileApiClient.getProductById(productId);
      return envelope.data ?? null;
    },
    enabled: Boolean(productId),
  });
}
