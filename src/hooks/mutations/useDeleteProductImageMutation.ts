import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";

export function useDeleteProductImageMutation(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      await mobileApiClient.deleteProductImage(productId, imageId);
      return imageId;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
