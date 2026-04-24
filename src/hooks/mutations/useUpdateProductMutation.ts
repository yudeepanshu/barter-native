import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, UpdateProductInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { invalidateRequestCollections, invalidateProductCollections, syncProductEntity } from "@/lib/query/mutationSync";

export function useUpdateProductMutation(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProductInput) => {
      const envelope = await mobileApiClient.updateProduct(productId, payload);
      if (!envelope.data) {
        throw new Error("No product returned from server");
      }
      return envelope.data;
    },
    onSuccess: (updatedProduct) => {
      syncProductEntity(queryClient, updatedProduct);
      void Promise.all([
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
