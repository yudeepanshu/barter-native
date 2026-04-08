import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, CreateProductInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  const upsertProduct = useAppDataStore((state) => state.upsertProduct);

  return useMutation({
    mutationFn: async (payload: CreateProductInput) => {
      const envelope = await mobileApiClient.createProduct(payload);
      if (!envelope.data) {
        throw new Error("No product returned from server");
      }
      return envelope.data;
    },
    onSuccess: async (product) => {
      upsertProduct(product);
      queryClient.setQueryData(queryKeys.products.detail(product.id), product);
      await queryClient.invalidateQueries({ queryKey: ["products", "infinite"] });
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
