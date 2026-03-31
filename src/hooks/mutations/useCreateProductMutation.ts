import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, CreateProductInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";

export function useCreateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductInput) => {
      const envelope = await mobileApiClient.createProduct(payload);
      if (!envelope.data) {
        throw new Error("No product returned from server");
      }
      return envelope.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
