import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import {
  invalidateProductCollections,
  invalidateRequestCollections,
  syncProductEntity,
} from "@/lib/query/mutationSync";

export function useRelistProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await mobileApiClient.relistProduct(productId);
      return result.data ?? null;
    },
    onSuccess: (updated, productId) => {
      if (!updated) {
        void Promise.all([
          invalidateProductCollections(queryClient),
          invalidateRequestCollections(queryClient),
        ]);
        return;
      }

      syncProductEntity(queryClient, updated);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) }),
        invalidateRequestCollections(queryClient),
      ]);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
