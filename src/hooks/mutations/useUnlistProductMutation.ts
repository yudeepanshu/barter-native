import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import {
  invalidateProductCollections,
  invalidateRequestCollections,
  syncProductEntity,
} from "@/lib/query/mutationSync";

export function useUnlistProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await mobileApiClient.updateProduct(productId, { isListed: false });
      return result.data ?? null;
    },
    onSuccess: (updated) => {
      if (!updated) {
        void Promise.all([
          invalidateProductCollections(queryClient),
          invalidateRequestCollections(queryClient),
        ]);
        return;
      }

      syncProductEntity(queryClient, updated);
      void invalidateRequestCollections(queryClient);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
