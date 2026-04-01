import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, ProductSummary } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";

type ProductPage = { items: ProductSummary[]; nextCursor: string | null; hasMore: boolean };

export function useUnlistProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await mobileApiClient.updateProduct(productId, { isListed: false });
      return result.data ?? null;
    },
    onSuccess: async (updated) => {
      if (!updated) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["products"] }),
          queryClient.invalidateQueries({ queryKey: ["requests"] }),
        ]);
        return;
      }

      queryClient.setQueriesData<InfiniteData<ProductPage>>(
        { queryKey: ["products"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === updated.id ? updated : item,
              ) as ProductSummary[],
            })),
          };
        },
      );

      await queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
