import { useColorScheme } from "react-native";
import { useEffect, useMemo } from "react";
import { getAppTheme, resolveThemeMode } from "@/theme/appTheme";
import { useThemeStore } from "@/lib/theme/themeStore";
 
export function useAppTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const initializeFromSystem = useThemeStore((state) => state.initializeFromSystem);
 
  const resolvedSystemScheme = systemScheme === "unspecified" ? null : systemScheme;
 
  useEffect(() => {
    const stored = useThemeStore.getState().preference;
    if (!stored) {
      initializeFromSystem(resolvedSystemScheme);
    }
  }, [resolvedSystemScheme, initializeFromSystem]);
 
  const resolvedMode = resolveThemeMode(preference, resolvedSystemScheme);
  const theme = useMemo(() => getAppTheme(resolvedMode), [resolvedMode]);
 
  return {
    theme,
    preference,
    resolvedMode,
    setPreference,
    statusBarStyle: resolvedMode === "dark" ? ("light" as const) : ("dark" as const),
  };
}