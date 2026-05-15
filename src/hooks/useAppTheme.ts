import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { getAppTheme } from "@/theme/appTheme";
import { useThemeStore } from "@/lib/theme/themeStore";

export function useAppTheme() {
  const colorScheme = useColorScheme();

  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const setToAuto = useThemeStore((state) => state.setToAuto);

  const systemScheme: "light" | "dark" =
    colorScheme === "dark" ? "dark" : "light";

  const resolvedMode: "light" | "dark" =
    preference === "auto" ? systemScheme : preference;

  const theme = useMemo(() => getAppTheme(resolvedMode), [resolvedMode]);
  const isAuto = preference === "auto";

  return {
    theme,
    preference,
    resolvedMode,
    isAuto,
    setPreference,
    setToAuto,
    statusBarStyle: resolvedMode === "dark" ? ("light" as const) : ("dark" as const),
  };
}