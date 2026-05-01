import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useReportProductMutation(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { reportType: string; reason?: string; description?: string }) =>
      mobileApiClient.reportProduct(productId, payload),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
      void queryClient.invalidateQueries({ queryKey: ["products", "infinite"] });
    },
  });
}