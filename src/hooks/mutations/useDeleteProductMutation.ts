import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

type ProductsPage = {
  items: Array<{ id: string }>;
  nextCursor: string | null;
  hasMore: boolean;
};

type ProductsInfiniteData = {
  pages: ProductsPage[];
  pageParams: unknown[];
};

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      await mobileApiClient.deleteProduct(productId);
      return productId;
    },
    onSuccess: async (deletedProductId) => {
      queryClient.setQueriesData(
        { queryKey: ["products", "infinite"] },
        (existing: ProductsInfiniteData | undefined) => {
          if (!existing) {
            return existing;
          }

          return {
            ...existing,
            pages: existing.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== deletedProductId),
            })),
          };
        },
      );

      queryClient.removeQueries({ queryKey: queryKeys.products.detail(deletedProductId) });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
      ]);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
