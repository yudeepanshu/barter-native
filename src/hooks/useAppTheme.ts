import { useColorScheme } from "react-native";
import { useEffect, useMemo } from "react";
import { getAppTheme, resolveThemeMode } from "@/theme/appTheme";
import { useThemeStore } from "@/lib/theme/themeStore";

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const initializeFromSystem = useThemeStore((state) => state.initializeFromSystem);

  // Initialize theme preference from system on first app load
  useEffect(() => {
    const stored = useThemeStore.getState().preference;
    // If no stored preference, initialize from system
    if (!stored || stored === undefined) {
      initializeFromSystem(systemScheme === "unspecified" ? null : systemScheme);
    }
  }, []);

  const resolvedMode = resolveThemeMode(
    preference,
    systemScheme === "unspecified" ? null : systemScheme,
  );
  const theme = useMemo(() => getAppTheme(resolvedMode), [resolvedMode]);

  return {
    theme,
    preference,
    resolvedMode,
    setPreference,
    statusBarStyle: resolvedMode === "dark" ? ("light" as const) : ("dark" as const),
  };
}
