import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { AuthSession, AuthStatus } from "@barter/types";
import { useAppDataStore } from "@/lib/store/appDataStore";

/**
 * Custom storage adapter that delegates to expo-secure-store.
 * Tokens and user profile are encrypted at rest on the device.
 */
const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

interface AuthState {
  session: AuthSession | null;
  status: AuthStatus;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      // Starts loading until SecureStore async rehydration completes
      status: "loading" as AuthStatus,
      setSession: (session) => {
        const previousUserId = useAuthStore.getState().session?.user.id;
        if (previousUserId && previousUserId !== session.user.id) {
          useAppDataStore.getState().reset();
        }

        useAppDataStore.getState().setProfile(session.user);
        set({ session, status: "authenticated" });
      },
      clearSession: () => {
        useAppDataStore.getState().reset();
        set({ session: null, status: "unauthenticated" });
      },
    }),
    {
      name: "barter-auth",
      storage: createJSONStorage(() => secureStorage),
      // Only persist the session object; status is derived on rehydration
      partialize: (state) => ({ session: state.session }),
      // Skip auto-hydration --- Providers triggers it after mounting
      skipHydration: true,
    },
  ),
);
