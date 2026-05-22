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
import { sanitizeMultiLineInput, sanitizeOptionalText } from "@/lib/utils/inputSanitizer";
import {
  invalidateProductCollections,
  invalidateRequestCollectionByScope,
  invalidateRequestCollections,
  invalidateTransactionForRequest,
  syncRequestMutationResult,
} from "@/lib/query/mutationSync";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppStore } from "@/lib/store/appStore";

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
    onSuccess: (result) => {
      syncRequestMutationResult(queryClient, result);

      const invalidations: Promise<unknown>[] = [];
      invalidations.push(invalidateRequestCollectionByScope(queryClient, "sent"));
      invalidations.push(invalidateProductCollections(queryClient));

      if (result?.request) {
        const req = result.request;
        if (req.productId) {
          invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(req.productId) }));
        }

        for (const offer of req.offers ?? []) {
          if ((offer as any)?.productId) {
            invalidations.push(
              queryClient.invalidateQueries({ queryKey: queryKeys.products.detail((offer as any).productId) }),
            );
          }
        }
      }

      void Promise.all(invalidations);
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
    onSuccess: (result, requestId) => {
      const viewerId = useAppStore.getState().profile?.id;
      const invalidateScope =
        viewerId && result?.request
          ? result.request.buyerId === viewerId
            ? "sent"
            : result.request.sellerId === viewerId
              ? "received"
              : null
          : null;

      syncRequestMutationResult(queryClient, result);
      void Promise.all([
        invalidateScope
          ? invalidateRequestCollectionByScope(queryClient, invalidateScope)
          : invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, requestId),
        invalidateProductCollections(queryClient),
      ]);
    },
  });
}

export function useRejectRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      try {
        const payload: CancelRequestInput = { reason: sanitizeMultiLineInput(reason, 500) ?? "" };
        const envelope = await mobileApiClient.rejectRequest(requestId, payload);
        return envelope.data ?? null;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: (result, variables) => {
      const viewerId = useAppStore.getState().profile?.id;
      const invalidateScope =
        viewerId && result?.request
          ? result.request.buyerId === viewerId
            ? "sent"
            : result.request.sellerId === viewerId
              ? "received"
              : null
          : null;

      syncRequestMutationResult(queryClient, result);
      void Promise.all([
        invalidateScope
          ? invalidateRequestCollectionByScope(queryClient, invalidateScope)
          : invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, variables.requestId),
        invalidateProductCollections(queryClient),
      ]);
    },
  });
}

export function useCancelRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      try {
        const payload: CancelRequestInput = { reason: sanitizeMultiLineInput(reason, 500) ?? "" };
        const envelope = await mobileApiClient.cancelRequest(requestId, payload);
        return envelope.data ?? null;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: (result, variables) => {
      const viewerId = useAppStore.getState().profile?.id;
      const invalidateScope =
        viewerId && result?.request
          ? result.request.buyerId === viewerId
            ? "sent"
            : result.request.sellerId === viewerId
              ? "received"
              : null
          : null;

      syncRequestMutationResult(queryClient, result);
      void Promise.all([
        invalidateScope
          ? invalidateRequestCollectionByScope(queryClient, invalidateScope)
          : invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, variables.requestId),
        invalidateProductCollections(queryClient),
      ]);
    },
  });
}

export function useCancelAllRequestsForProductMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      try {
        const payload: CancelRequestInput = { reason: sanitizeMultiLineInput(reason, 500) ?? "" };
        const envelope = await mobileApiClient.cancelAllRequestsForProduct(requestId, payload);
        return envelope.data ?? null;
      } catch (error) {
        if (isDuplicateIdempotencyError(error)) {
          return null;
        }
        throw error;
      }
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData(['requests', 'detail', variables.requestId], (existing: any) => {
        return existing ? { ...existing, isReservedProductUsedInOtherOffers: false } : existing;
      });
      syncRequestMutationResult(queryClient, result);
      void Promise.all([
        invalidateRequestCollections(queryClient),
        invalidateTransactionForRequest(queryClient, variables.requestId),
        invalidateProductCollections(queryClient),
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
      const viewerId = useAppStore.getState().profile?.id;
      const invalidateScope =
        viewerId && result?.request
          ? result.request.buyerId === viewerId
            ? "sent"
            : result.request.sellerId === viewerId
              ? "received"
              : null
          : null;

      syncRequestMutationResult(queryClient, result);

      const invalidations: Promise<unknown>[] = [];
      invalidations.push(
        invalidateScope
          ? invalidateRequestCollectionByScope(queryClient, invalidateScope)
          : invalidateRequestCollections(queryClient),
      );
      invalidations.push(invalidateTransactionForRequest(queryClient, variables.requestId));
      invalidations.push(invalidateProductCollections(queryClient));

      if (result?.request) {
        const req = result.request;
        if (req.productId) {
          invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(req.productId) }));
        }

        for (const offer of req.offers ?? []) {
          if ((offer as any)?.productId) {
            invalidations.push(
              queryClient.invalidateQueries({ queryKey: queryKeys.products.detail((offer as any).productId) }),
            );
          }
        }
      }

      void Promise.all(invalidations);
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
    onSuccess: (result, variables) => {
      syncRequestMutationResult(queryClient, result);
      void invalidateTransactionForRequest(queryClient, variables.requestId);
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
    onSuccess: (result, variables) => {
      syncRequestMutationResult(queryClient, result);
      void invalidateTransactionForRequest(queryClient, variables.requestId);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
