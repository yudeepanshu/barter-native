import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

export function useReportProductMutation(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { reportType: string; reason?: string; description?: string }) =>
      mobileApiClient.reportProduct(productId, payload),

    onSuccess: () => {
      const existing = useAppDataStore.getState().productsById[productId];
      if (existing) {
        useAppDataStore.getState().upsertProduct({
          ...existing,
          viewerHasReported: true,
        });
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
      void queryClient.invalidateQueries({ queryKey: ["products", "infinite"] });
    },
  });
}