import { ApiClient } from "@barter/api-client";
import { mobileTokenStore } from "../auth/tokenStore";
import { useAuthStore } from "../auth/authStore";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://barter-backend-6ypo.onrender.com/api";

const mobileAuthClient = new ApiClient({
  baseURL: apiBaseUrl,
});

export const mobileApiClient = new ApiClient({
  baseURL: apiBaseUrl,
  tokenStore: mobileTokenStore,
  refreshAccessToken: async (refreshToken) => {
    const envelope = await mobileAuthClient.refreshToken({ refreshToken });
    const tokens = envelope.data;

    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error("Missing refresh token payload");
    }

    return tokens;
  },
  onAuthFailure: () => {
    useAuthStore.getState().clearSession();
  },
});
