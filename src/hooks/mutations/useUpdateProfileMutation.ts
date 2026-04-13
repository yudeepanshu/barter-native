import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, UpdateUserProfileInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import {
  sanitizeEmailInput,
  sanitizePhoneInput,
  sanitizeProfileUserName,
  sanitizeSingleLineInput,
} from "@/lib/utils/inputSanitizer";

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setProfile = useAppDataStore((state) => state.setProfile);

  return useMutation({
    mutationFn: async (payload: UpdateUserProfileInput) => {
      const currentUser = useAuthStore.getState().session?.user;
      const nextUserName =
        typeof payload.userName === "string"
          ? sanitizeProfileUserName(payload.userName).trim()
          : payload.userName;
      const nextEmail =
        typeof payload.email === "string" ? sanitizeEmailInput(payload.email).trim() : payload.email;
      const nextMobileNumber =
        typeof payload.mobileNumber === "string"
          ? sanitizePhoneInput(payload.mobileNumber)
          : payload.mobileNumber;

      if (currentUser?.userName?.trim() && nextUserName === "") {
        throw new Error("Name cannot be empty once set.");
      }

      if (currentUser?.email?.trim() && (nextEmail === null || nextEmail === "")) {
        throw new Error("Email cannot be empty once set.");
      }

      if (currentUser?.mobileNumber?.trim() && (nextMobileNumber === null || nextMobileNumber === "")) {
        throw new Error("Phone number cannot be empty once set.");
      }

      const sanitizedPayload: UpdateUserProfileInput = {
        ...payload,
        userName: nextUserName,
        email: nextEmail === "" ? null : nextEmail,
        mobileNumber: nextMobileNumber === "" ? null : nextMobileNumber,
        profilePicture:
          typeof payload.profilePicture === "string"
            ? sanitizeSingleLineInput(payload.profilePicture, 2048)
            : payload.profilePicture,
      };

      const envelope = await mobileApiClient.updateCurrentUser(sanitizedPayload);
      if (!envelope.data) {
        throw new Error("No user returned from server");
      }
      return envelope.data;
    },
    onSuccess: async (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
      setProfile(user);

      const session = useAuthStore.getState().session;
      if (session) {
        useAuthStore.getState().setSession({
          ...session,
          user,
        });
      }
    },
  });
}

export function toErrorMessage(error: unknown) {
  const shaped = ApiClient.toApiError(error) as ApiErrorShape;
  return shaped.message;
}