import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type {
  ApiErrorShape,
  CreateProductQueryInput,
  ReplyProductQueryInput,
  ReportProductQueryInput,
} from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

// ── Create query (buyer posts a question) ─────────────────────────────────────

export function useCreateProductQueryMutation(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductQueryInput) => {
      const envelope = await mobileApiClient.createProductQuery(productId, payload);
      if (!envelope.data) {
        throw new Error("No query returned from server");
      }
      return envelope.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.productQueries.list(productId),
      });
    },
  });
}

// ── Reply to query (seller only) ──────────────────────────────────────────────

export function useReplyProductQueryMutation(productId: string, queryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReplyProductQueryInput) => {
      const envelope = await mobileApiClient.replyToProductQuery(productId, queryId, payload);
      if (!envelope.data) {
        throw new Error("No response returned from server");
      }
      return envelope.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.productQueries.list(productId),
      });
    },
  });
}

// ── Report a query ────────────────────────────────────────────────────────────

export function useReportProductQueryMutation(productId: string, queryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReportProductQueryInput) => {
      const envelope = await mobileApiClient.reportProductQuery(productId, queryId, payload);
      return envelope.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.productQueries.list(productId),
      });
    },
  });
}

export function toQueryErrorMessage(error: unknown): string {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message ?? "Something went wrong. Please try again.";
}