import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ThemePreference } from "@/theme/appTheme";

const themeStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  initializeFromSystem: (systemScheme: "light" | "dark" | null) => void;
}

function getInitialThemePreference(systemScheme: "light" | "dark" | null): ThemePreference {
  return systemScheme === "dark" ? "dark" : "light";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "light",
      setPreference: (preference) => set({ preference }),
      initializeFromSystem: (systemScheme) => {
        set({ preference: getInitialThemePreference(systemScheme) });
      },
    }),
    {
      name: "barter-theme-preference",
      storage: createJSONStorage(() => themeStorage),
      partialize: (state) => ({ preference: state.preference }),
    },
  ),
);
