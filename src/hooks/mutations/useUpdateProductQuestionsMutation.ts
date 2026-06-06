import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import type { ProductQuestionsPayload } from "@/components/products/ProductQuestionsModal";

const toQuestionsArray = (payload: ProductQuestionsPayload) =>
  Object.entries(payload).map(([key, value]) => ({ key, value: value ?? null }));

export function useUpdateProductQuestionsMutation(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProductQuestionsPayload) => {
      const envelope = await mobileApiClient.updateProductQuestions(
        productId,
        toQuestionsArray(payload),
      );
      if (!envelope.data) {
        throw new Error("No questions returned from server");
      }
      return envelope.data;
    },
    onSuccess: (updatedQuestions) => {
      queryClient.setQueriesData(
        { queryKey: queryKeys.products.detail(productId) },
        (old: any) => {
          if (!old) return old;
          return { ...old, optionalQuestions: updatedQuestions };
        },
      );
    },
  });
}