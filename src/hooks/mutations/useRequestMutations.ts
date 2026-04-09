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
import {
  invalidateRequestCollections,
  invalidateTransactionForRequest,
  syncRequestMutationResult,
} from "@/lib/query/mutationSync";

export function useCreateRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateRequestInput) => {
      const envelope = await mobileApiClient.createRequest(payload);
      if (!envelope.data) {
        throw new Error("No request returned from server");
      }
      return envelope.data;
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
      const envelope = await mobileApiClient.acceptRequest(requestId);
      return envelope.data ?? null;
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
      const envelope = await mobileApiClient.rejectRequest(requestId);
      return envelope.data ?? null;
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
      const payload: CancelRequestInput = { reason };
      const envelope = await mobileApiClient.cancelRequest(requestId, payload);
      return envelope.data ?? null;
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
      const envelope = await mobileApiClient.createCounterOffer(requestId, payload);
      if (!envelope.data) {
        throw new Error("No request returned from counter offer");
      }
      return envelope.data;
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

export function useRequestContactRevealMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, payload }: { requestId: string; payload: RequestContactRevealInput }) => {
      const envelope = await mobileApiClient.requestContactReveal(requestId, payload);
      if (!envelope.data) {
        throw new Error("No request returned from contact reveal request");
      }
      return envelope.data;
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
      const envelope = await mobileApiClient.respondContactReveal(requestId, revealRequestId, payload);
      if (!envelope.data) {
        throw new Error("No request returned from contact reveal response");
      }
      return envelope.data;
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
