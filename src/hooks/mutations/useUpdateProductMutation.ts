import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, UpdateProductInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

export function useUpdateProductMutation(productId: string) {
  const queryClient = useQueryClient();
  const upsertProduct = useAppDataStore((state) => state.upsertProduct);

  return useMutation({
    mutationFn: async (payload: UpdateProductInput) => {
      const envelope = await mobileApiClient.updateProduct(productId, payload);
      if (!envelope.data) {
        throw new Error("No product returned from server");
      }
      return envelope.data;
    },
    onSuccess: async (updatedProduct) => {
      upsertProduct(updatedProduct);
      queryClient.setQueryData(queryKeys.products.detail(updatedProduct.id), updatedProduct);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
      ]);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
