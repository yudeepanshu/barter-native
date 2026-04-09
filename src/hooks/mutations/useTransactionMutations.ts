import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, VerifyTransactionOtpInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { invalidateTransactionRelated } from "@/lib/query/mutationSync";

export function useGenerateTransactionOtpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      const envelope = await mobileApiClient.generateTransactionOtp(transactionId);
      if (!envelope.data) {
        throw new Error("No OTP payload returned from server");
      }
      return envelope.data;
    },
    onSuccess: async () => {
      await invalidateTransactionRelated(queryClient);
    },
  });
}

export function useVerifyTransactionOtpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, otp }: { transactionId: string; otp: string }) => {
      const payload: VerifyTransactionOtpInput = { otp };
      const envelope = await mobileApiClient.verifyTransactionOtp(transactionId, payload);
      if (!envelope.data) {
        throw new Error("No transaction returned after OTP verification");
      }
      return envelope.data;
    },
    onSuccess: async () => {
      await invalidateTransactionRelated(queryClient);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
