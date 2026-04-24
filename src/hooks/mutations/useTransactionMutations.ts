import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, VerifyTransactionOtpInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import {
  invalidateProductCollections,
  invalidateRequestCollections,
  invalidateTransactionForRequest,
  syncTransactionEntity,
} from "@/lib/query/mutationSync";
import { queryKeys } from "@/lib/query/queryKeys";

function isDuplicateIdempotencyError(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  if (shaped.statusCode !== 409) {
    return false;
  }

  const normalized = (shaped.message ?? "").toLowerCase();
  return normalized.includes("duplicate") || normalized.includes("idempotency");
}

export function useGenerateTransactionOtpMutation() {
  return useMutation({
    mutationFn: async (transactionId: string) => {
      try {
        const envelope = await mobileApiClient.generateTransactionOtp(transactionId);
        if (!envelope.data) {
          throw new Error("No OTP payload returned from server");
        }
        return envelope.data;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function useVerifyTransactionOtpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, otp }: { transactionId: string; otp: string }) => {
      try {
        const payload: VerifyTransactionOtpInput = { otp };
        const envelope = await mobileApiClient.verifyTransactionOtp(transactionId, payload);
        if (!envelope.data) {
          throw new Error("No transaction returned after OTP verification");
        }
        return envelope.data;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: (transaction) => {
      if (!transaction) {
        return;
      }

      syncTransactionEntity(queryClient, transaction);
      queryClient.setQueryData(queryKeys.transactions.activeByProduct(transaction.productId), transaction);

      void Promise.all([
        invalidateTransactionForRequest(queryClient, transaction.requestId),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.activeByProduct(transaction.productId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(transaction.requestId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(transaction.productId) }),
        invalidateRequestCollections(queryClient),
        invalidateProductCollections(queryClient),
      ]);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
