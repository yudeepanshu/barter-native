import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { AuthSession, AuthStatus } from "@barter/types";
import { useAppDataStore } from "@/lib/store/appDataStore";

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

interface AuthState {
  session: AuthSession | null;
  status: AuthStatus;
  _hasHydrated: boolean; // 1️⃣ New flag
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      status: "loading" as AuthStatus,
      _hasHydrated: false, // 2️⃣ Default false before SecureStore is read
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
      partialize: (state) => ({ session: state.session }),
      skipHydration: true,
    },
  ),
);