import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, CreateProductInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { syncProductEntity } from "@/lib/query/mutationSync";
import {
  sanitizeDescriptionInput,
  sanitizeLocationNameInput,
  sanitizeTitleInput,
} from "@/lib/utils/inputSanitizer";

export function useCreateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductInput) => {
      const sanitizedPayload: CreateProductInput = {
        ...payload,
        title: sanitizeTitleInput(payload.title),
        description:
          typeof payload.description === "string"
            ? sanitizeDescriptionInput(payload.description)
            : payload.description,
        locationName:
          typeof payload.locationName === "string"
            ? sanitizeLocationNameInput(payload.locationName)
            : payload.locationName,
      };

      const envelope = await mobileApiClient.createProduct(sanitizedPayload);
      if (!envelope.data) {
        throw new Error("No product returned from server");
      }
      return envelope.data;
    },
    onSuccess: (product) => {
      syncProductEntity(queryClient, product);
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}
