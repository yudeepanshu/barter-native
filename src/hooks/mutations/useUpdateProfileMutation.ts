import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape, UpdateUserProfileInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setProfile = useAppDataStore((state) => state.setProfile);

  return useMutation({
    mutationFn: async (payload: UpdateUserProfileInput) => {
      const envelope = await mobileApiClient.updateCurrentUser(payload);
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