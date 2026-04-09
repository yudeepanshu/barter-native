import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import {
  invalidateProductCollections,
  invalidateRequestCollections,
  removeProductEntity,
} from "@/lib/query/mutationSync";

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      await mobileApiClient.deleteProduct(productId);
      return productId;
    },
    onSuccess: async (deletedProductId) => {
      removeProductEntity(queryClient, deletedProductId);

      await Promise.all([
        invalidateProductCollections(queryClient),
        invalidateRequestCollections(queryClient),
      ]);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
