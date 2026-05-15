export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedThemeMode = "light" | "dark" | "auto";

interface ButtonConfig {
  backgroundColor: string;
  pressedBackgroundColor: string;
  borderColor: string;
  borderWidth: number;
  labelColor: string;
}

export interface AppTheme {
  mode: ResolvedThemeMode;
  roundness: number;
  colors: {
    primary: string;
    primaryPressed: string;
    onPrimary: string;
    success: string;
    onSuccess: string;
    background: string;
    backgroundElevated: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    chipBg: string;
    chipActiveBg: string;
    chipText: string;
    chipActiveText: string;
    danger: string;
      warning: string;
    dangerSoft: string;
    warningSoft: string;
    overlay: string;
  };
  shadow: {
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  };
  buttons: {
    primary: ButtonConfig;
    success: ButtonConfig;
    ghost: ButtonConfig;
    tertiary: ButtonConfig;
  }
}

const sharedShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 20,
  elevation: 6,
};

export const lightTheme: AppTheme = {
  mode: "light",
  roundness: 18,
  colors: {
    primary: "#111827",
    primaryPressed: "#030712",
    onPrimary: "#f9fafb",
    success: "#f97316",
    onSuccess: "#fff7ed",
    background: "#f3f4f6",
    backgroundElevated: "#ffffff",
    surface: "#ffffff",
    surfaceMuted: "#eef2f7",
    border: "#dbe3ee",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    chipBg: "#eef2f7",
    chipActiveBg: "#111827",
    chipText: "#334155",
    chipActiveText: "#f9fafb",
    danger: "#b91c1c",
    warning: "#b45309",
    dangerSoft: "#fee2e2",
    warningSoft: "#fef3c7",
    overlay: "rgba(15, 23, 42, 0.72)",
  },
  shadow: {
    card: {
      ...sharedShadow,
      shadowOpacity: 0.08,
    },
  },
  buttons: {
    primary: {
      backgroundColor: "#111827",
      pressedBackgroundColor: "#030712",
      borderColor: "transparent",
      borderWidth: 0,
      labelColor: "#f9fafb",
    },
    success: {
      backgroundColor: "#f97316",
      pressedBackgroundColor: "#f97316",
      borderColor: "transparent",
      borderWidth: 0,
      labelColor: "#fff7ed",
    },
    ghost: {
      backgroundColor: "transparent",
      pressedBackgroundColor: "#dbe3ee",  // was #eef2f7 — now uses border color as pressed fill
      borderColor: "#ccd8e9",             // was #dbe3ee — stronger, slate-gray border
      borderWidth: 1,
      labelColor: "#0f172a",              // was #334155 — bump to textPrimary for contrast
    },
    tertiary: {
      backgroundColor: "transparent",
      pressedBackgroundColor: "#eef2f7",
      borderColor: "transparent",
      borderWidth: 0,
      labelColor: "#64748b",
    },
  },
};

export const darkTheme: AppTheme = {
  mode: "dark",
  roundness: 18,
  colors: {
    primary: "#f8fafc",
    primaryPressed: "#e2e8f0",
    onPrimary: "#0f172a",
    success: "#fb923c",
    onSuccess: "#111827",
    background: "#020617",
    backgroundElevated: "#0b1220",
    surface: "#111827",
    surfaceMuted: "#1e293b",
    border: "#253247",
    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",
    chipBg: "#1e293b",
    chipActiveBg: "#f8fafc",
    chipText: "#cbd5e1",
    chipActiveText: "#111827",
    danger: "#f87171",
    warning: "#b45309",
    dangerSoft: "#3f1d25",
    warningSoft: "#3f2d15",
    overlay: "rgba(2, 6, 23, 0.82)",
  },
  shadow: {
    card: {
      ...sharedShadow,
      shadowOpacity: 0.28,
    },
  },
  buttons: {
    primary: {
      backgroundColor: "#f8fafc",
      pressedBackgroundColor: "#e2e8f0",
      borderColor: "transparent",
      borderWidth: 0,
      labelColor: "#0f172a",
    }, 
    success: {
      backgroundColor: "#fb923c",
      pressedBackgroundColor: "#fb923c",
      borderColor: "transparent",
      borderWidth: 0,
      labelColor: "#111827",
    },
    ghost: {
      backgroundColor: "transparent",
      pressedBackgroundColor: "#253247",  // unchanged, already fine
      borderColor: "#3f4b5c",             // was #253247 — lighter, more visible against dark bg
      borderWidth: 0.7,
      labelColor: "#f8fafc",             // unchanged
    },
    tertiary: {
      backgroundColor: "transparent",
      pressedBackgroundColor: "#1e293b",
      borderColor: "transparent",
      borderWidth: 0,
      labelColor: "#cbd5e1",
    },
  },
};

export function resolveThemeMode(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null,
): ResolvedThemeMode {
  return preference;
}

export function getAppTheme(mode: ResolvedThemeMode): AppTheme {
  return mode === "dark" ? darkTheme : lightTheme;
}
