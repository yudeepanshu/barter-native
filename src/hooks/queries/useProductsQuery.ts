import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProductsQueryInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useProductsQuery(filters: Omit<ProductsQueryInput, "cursor">) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.infinite(filters),
    queryFn: async ({ pageParam }) => {
      const envelope = await mobileApiClient.getProducts({
        ...filters,
        cursor: pageParam ?? undefined,
      });
      return envelope.data ?? { items: [], nextCursor: null, hasMore: false };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
}
