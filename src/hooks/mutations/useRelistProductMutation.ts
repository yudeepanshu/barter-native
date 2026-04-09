import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
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
    onSuccess: async (updated) => {
      if (!updated) {
        await Promise.all([
          invalidateProductCollections(queryClient),
          invalidateRequestCollections(queryClient),
        ]);
        return;
      }

      syncProductEntity(queryClient, updated);
      await invalidateRequestCollections(queryClient);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
