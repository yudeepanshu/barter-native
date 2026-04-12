import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type {
  ApiErrorShape,
  CancelRequestInput,
  CreateCounterOfferInput,
  CreateRequestInput,
  RequestContactRevealInput,
  RespondContactRevealInput,
} from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { sanitizeOptionalText } from "@/lib/utils/inputSanitizer";
import {
  invalidateRequestCollections,
  invalidateTransactionForRequest,
  syncRequestMutationResult,
} from "@/lib/query/mutationSync";

function isDuplicateIdempotencyError(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  if (shaped.statusCode !== 409) {
    return false;
  }

  const normalized = (shaped.message ?? "").toLowerCase();
  return normalized.includes("duplicate") || normalized.includes("idempotency");
}

export function useCreateRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateRequestInput) => {
      try {
        const sanitizedPayload: CreateRequestInput = {
          ...payload,
          message: sanitizeOptionalText(payload.message, 1000),
        };
        const envelope = await mobileApiClient.createRequest(sanitizedPayload);
        if (!envelope.data) {
          throw new Error("No request returned from server");
        }
        return envelope.data;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      syncRequestMutationResult(queryClient, result);
      await invalidateRequestCollections(queryClient);
    },
  });
}

export function useAcceptRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      try {
        const envelope = await mobileApiClient.acceptRequest(requestId);
        return envelope.data ?? null;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: async (result, requestId) => {
      syncRequestMutationResult(queryClient, result);
      await Promise.all([
        invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, requestId),
      ]);
    },
  });
}

export function useRejectRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      try {
        const envelope = await mobileApiClient.rejectRequest(requestId);
        return envelope.data ?? null;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: async (result, requestId) => {
      syncRequestMutationResult(queryClient, result);
      await Promise.all([
        invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, requestId),
      ]);
    },
  });
}

export function useCancelRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      try {
        const payload: CancelRequestInput = { reason: sanitizeOptionalText(reason, 500) ?? "" };
        const envelope = await mobileApiClient.cancelRequest(requestId, payload);
        return envelope.data ?? null;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: async (result, variables) => {
      syncRequestMutationResult(queryClient, result);
      await Promise.all([
        invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, variables.requestId),
      ]);
    },
  });
}

export function useCreateCounterOfferMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: CreateCounterOfferInput;
    }) => {
      try {
        const sanitizedPayload: CreateCounterOfferInput = {
          ...payload,
          message: sanitizeOptionalText(payload.message, 1000),
        };
        const envelope = await mobileApiClient.createCounterOffer(requestId, sanitizedPayload);
        if (!envelope.data) {
          throw new Error("No request returned from counter offer");
        }
        return envelope.data;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: (result, variables) => {
      syncRequestMutationResult(queryClient, result);
      void Promise.all([
        invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, variables.requestId),
      ]);
    },
  });
}

export function useRequestContactRevealMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, payload }: { requestId: string; payload: RequestContactRevealInput }) => {
      try {
        const sanitizedPayload: RequestContactRevealInput = {
          ...payload,
          note: sanitizeOptionalText(payload.note, 500),
        };
        const envelope = await mobileApiClient.requestContactReveal(requestId, sanitizedPayload);
        if (!envelope.data) {
          throw new Error("No request returned from contact reveal request");
        }
        return envelope.data;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: async (result, variables) => {
      syncRequestMutationResult(queryClient, result);
      await invalidateTransactionForRequest(queryClient, variables.requestId);
    },
  });
}

export function useRespondContactRevealMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      revealRequestId,
      payload,
    }: {
      requestId: string;
      revealRequestId: string;
      payload: RespondContactRevealInput;
    }) => {
      try {
        const envelope = await mobileApiClient.respondContactReveal(requestId, revealRequestId, payload);
        if (!envelope.data) {
          throw new Error("No request returned from contact reveal response");
        }
        return envelope.data;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: async (result, variables) => {
      syncRequestMutationResult(queryClient, result);
      await invalidateTransactionForRequest(queryClient, variables.requestId);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
