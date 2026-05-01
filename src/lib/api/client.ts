import { ApiClient } from "@barter/api-client";
import { mobileTokenStore } from "../auth/tokenStore";
import { useAuthStore } from "../auth/authStore";
import { Platform } from "react-native";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://barter-backend-6ypo.onrender.com/api";

const mobileAuthClient = new ApiClient({
  baseURL: apiBaseUrl,
  requestMetadataProvider: () => ({
    "X-Client-Platform": Platform.OS,
    "X-App-Version": process.env.EXPO_PUBLIC_APP_VERSION ?? "unknown",
  }),
});

export const mobileApiClient = new ApiClient({
  baseURL: apiBaseUrl,
  tokenStore: mobileTokenStore,
  requestMetadataProvider: () => ({
    "X-Client-Platform": Platform.OS,
    "X-App-Version": process.env.EXPO_PUBLIC_APP_VERSION ?? "unknown",
  }),
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

