import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProductQuery } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

interface ProductQueriesPage {
  queries: ProductQuery[];
  nextCursor: string | null;
}

interface UseProductQueriesQueryOptions {
  enabled?: boolean;
}

export function useProductQueriesQuery(
  productId: string,
  options: UseProductQueriesQueryOptions = {},
) {
  const { enabled = true } = options;

  return useInfiniteQuery({
    queryKey: queryKeys.productQueries.list(productId),
    enabled: enabled && Boolean(productId),
    queryFn: async ({ pageParam }): Promise<ProductQueriesPage> => {
      const envelope = await mobileApiClient.getProductQueries(productId, {
        limit: 10,
        cursor: pageParam ?? undefined,
      });
      return envelope.data ?? { queries: [], nextCursor: null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}