import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type {
  ApiErrorShape,
  CancelRequestInput,
  CreateCounterOfferInput,
  CreateRequestInput,
  RequestMutationResult,
  RequestContactRevealInput,
  RespondContactRevealInput,
} from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

function syncRequestMutationResult(
  queryClient: ReturnType<typeof useQueryClient>,
  result: RequestMutationResult | null | undefined,
  upsertRequest: (request: RequestMutationResult["request"]) => void,
  upsertOffers: (requestId: string, offers: RequestMutationResult["request"]["offers"]) => void,
) {
  if (!result?.request) {
    return;
  }

  const request = result.request;
  upsertRequest(request);
  upsertOffers(request.id, request.offers ?? []);

  queryClient.setQueryData(queryKeys.requests.detail(request.id), request);

  queryClient.setQueryData(
    ["requests", request.id, "offers", "desc"],
    {
      requestId: request.id,
      currentTurn: request.currentTurn,
      status: request.status,
      offers: [...(request.offers ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    },
  );

  queryClient.setQueryData(
    ["requests", request.id, "offers", "asc"],
    {
      requestId: request.id,
      currentTurn: request.currentTurn,
      status: request.status,
      offers: [...(request.offers ?? [])].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    },
  );
}

export function useCreateRequestMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

  return useMutation({
    mutationFn: async (payload: CreateRequestInput) => {
      const envelope = await mobileApiClient.createRequest(payload);
      if (!envelope.data) {
        throw new Error("No request returned from server");
      }
      return envelope.data;
    },
    onSuccess: async (result) => {
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] }),
      ]);
    },
  });
}

export function useAcceptRequestMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

  return useMutation({
    mutationFn: async (requestId: string) => {
      const envelope = await mobileApiClient.acceptRequest(requestId);
      return envelope.data ?? null;
    },
    onSuccess: async (result, requestId) => {
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.activeByRequest(requestId) }),
      ]);
    },
  });
}

export function useRejectRequestMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

  return useMutation({
    mutationFn: async (requestId: string) => {
      const envelope = await mobileApiClient.rejectRequest(requestId);
      return envelope.data ?? null;
    },
    onSuccess: async (result, requestId) => {
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.activeByRequest(requestId) }),
      ]);
    },
  });
}

export function useCancelRequestMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const payload: CancelRequestInput = { reason };
      const envelope = await mobileApiClient.cancelRequest(requestId, payload);
      return envelope.data ?? null;
    },
    onSuccess: async (result, variables) => {
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transactions.activeByRequest(variables.requestId),
        }),
      ]);
    },
  });
}

export function useCreateCounterOfferMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

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
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] }),
        queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transactions.activeByRequest(variables.requestId),
        }),
      ]);
    },
  });
}

export function useRequestContactRevealMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

  return useMutation({
    mutationFn: async ({ requestId, payload }: { requestId: string; payload: RequestContactRevealInput }) => {
      const envelope = await mobileApiClient.requestContactReveal(requestId, payload);
      if (!envelope.data) {
        throw new Error("No request returned from contact reveal request");
      }
      return envelope.data;
    },
    onSuccess: async (result, variables) => {
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.activeByRequest(variables.requestId),
      });
    },
  });
}

export function useRespondContactRevealMutation() {
  const queryClient = useQueryClient();
  const upsertRequest = useAppDataStore((state) => state.upsertRequest);
  const upsertOffers = useAppDataStore((state) => state.upsertOffers);

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
      syncRequestMutationResult(queryClient, result, upsertRequest, upsertOffers);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.activeByRequest(variables.requestId),
      });
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
