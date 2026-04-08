import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, ProductSummary } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

type ProductPage = { items: ProductSummary[]; nextCursor: string | null; hasMore: boolean };

export function useRelistProductMutation() {
  const queryClient = useQueryClient();
  const upsertProduct = useAppDataStore((state) => state.upsertProduct);

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await mobileApiClient.relistProduct(productId);
      return result.data ?? null;
    },
    onSuccess: async (updated) => {
      if (!updated) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["products", "infinite"] }),
          queryClient.invalidateQueries({ queryKey: ["requests"] }),
        ]);
        return;
      }

      upsertProduct(updated);
      queryClient.setQueryData(queryKeys.products.detail(updated.id), updated);

      queryClient.setQueriesData<InfiniteData<ProductPage>>(
        { queryKey: ["products"] },
        (old) => {
          if (!old || !Array.isArray(old.pages)) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === updated.id ? updated : item)),
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
