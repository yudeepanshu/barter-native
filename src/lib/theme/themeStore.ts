import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { ThemePreference } from "@/theme/appTheme";

const themeStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

interface ThemeState {
  preference: ThemePreference;
  _hasHydrated?: boolean;
  setPreference: (preference: ThemePreference) => void;
  setToAuto: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "auto",
      _hasHydrated: false,
      setPreference: (preference) => set({ preference }),
      setToAuto: () => set({ preference: "auto" }),
    }),
    {
      name: "barter-theme-preference",
      storage: createJSONStorage(() => themeStorage),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => {
        return () => {
          useThemeStore.setState({ _hasHydrated: true });
        }
      },
    },
  ),
);