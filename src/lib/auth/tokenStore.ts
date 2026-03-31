import type { TokenStore } from "@barter/api-client";
import { useAuthStore } from "./authStore";

/**
 * TokenStore adapter that delegates to the Zustand auth store.
 * Zustand's persist middleware (SecureStore) handles durability.
 * The API client uses this to inject / rotate tokens on every request.
 */
export const mobileTokenStore: TokenStore = {
  getTokens: () => useAuthStore.getState().session?.tokens ?? null,

  setTokens: (tokens) => {
    const s = useAuthStore.getState().session;
    if (s) {
      useAuthStore.setState({ session: { ...s, tokens } });
    }
  },

  clearTokens: () => {
    useAuthStore.getState().clearSession();
  },
};
