import { ApiClient } from "@barter/api-client";
import { mobileTokenStore } from "../auth/tokenStore";
import { useAuthStore } from "../auth/authStore";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://barter-backend-6ypo.onrender.com/api";

export const mobileApiClient = new ApiClient({
  baseURL: apiBaseUrl,
  tokenStore: mobileTokenStore,
  onAuthFailure: () => {
    useAuthStore.getState().clearSession();
  },
});
