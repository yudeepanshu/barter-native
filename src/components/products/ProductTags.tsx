import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ProductSummary } from "@barter/types";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

export type ProductTagTone = "mint" | "amber" | "violet" | "blue" | "teal" | "slate" | "rose" | "orange";

export interface ProductTagSpec {
  key?: string;
  label: string;
  tone: ProductTagTone;
  icon?: FeatherIconName;
  size?: 'sm' | 'md' | 'lg';
}

export const TAG_TONES: Record<
  ProductTagTone,
  {
    top: {
      light: { bg: string; border: string; text: string };
      dark: { bg: string; border: string; text: string };
    };
    bottom: {
      light: { bg: string; border: string; text: string };
      dark: { bg: string; border: string; text: string };
    };
  }
> = {
  mint: {
    top: {
      light: { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
      dark: { bg: "#052e1a", border: "#22c55e", text: "#4ade80" },
    },
    bottom: {
      light: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
      dark: { bg: "#052e1a", border: "#22c55e", text: "#4ade80" },
    },
  },
  amber: {
    top: {
      light: { bg: "#fffbeb", border: "#fbbf24", text: "#92400e" },
      dark: { bg: "#3b2400", border: "#f59e0b", text: "#fbbf24" },
    },
    bottom: {
      light: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
      dark: { bg: "#3b2400", border: "#f59e0b", text: "#fbbf24" },
    },
  },
  violet: {
    top: {
      light: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6" },
      dark: { bg: "#2e1065", border: "#8b5cf6", text: "#a78bfa" },
    },
    bottom: {
      light: { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" },
      dark: { bg: "#2e1065", border: "#8b5cf6", text: "#a78bfa" },
    },
  },
  blue: {
    top: {
      light: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
      dark: { bg: "#0c1b3b", border: "#3b82f6", text: "#93c5fd" },
    },
    bottom: {
      light: { bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
      dark: { bg: "#0c1b3b", border: "#3b82f6", text: "#93c5fd" },
    },
  },
  teal: {
    top: {
      light: { bg: "#f0fdfa", border: "#5eead4", text: "#0f766e" },
      dark: { bg: "#042f2e", border: "#14b8a6", text: "#5eead4" },
    },
    bottom: {
      light: { bg: "#ccfbf1", border: "#5eead4", text: "#0f766e" },
      dark: { bg: "#042f2e", border: "#14b8a6", text: "#5eead4" },
    },
  },
  slate: {
    top: {
      light: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" },
      dark: { bg: "#111827", border: "#475569", text: "#cbd5e1" },
    },
    bottom: {
      light: { bg: "#e2e8f0", border: "#cbd5e1", text: "#475569" },
      dark: { bg: "#111827", border: "#475569", text: "#cbd5e1" },
    },
  },
  rose: {
    top: {
      light: { bg: "#fff1f2", border: "#fda4af", text: "#b91c1c" },
      dark: { bg: "#3f0c17", border: "#fb7185", text: "#fda4af" },
    },
    bottom: {
      light: { bg: "#fee2e2", border: "#fda4af", text: "#b91c1c" },
      dark: { bg: "#3f0c17", border: "#fb7185", text: "#fda4af" },
    },
  },
  orange: {
    top: {
      light: { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" },
      dark: { bg: "#3c1a00", border: "#f97316", text: "#fdba74" },
    },
    bottom: {
      light: { bg: "#ffedd5", border: "#fdba74", text: "#c2410c" },
      dark: { bg: "#3c1a00", border: "#f97316", text: "#fdba74" },
    },
  },
};

const SIZE_STYLES = {
  sm: {
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.25, borderRadius: 6 },
    text: { fontSize: 9, letterSpacing: 0.3 },
    chip: { paddingHorizontal: 6, paddingVertical: 2, minHeight: 20 },
    chipText: { fontSize: 9 },
    iconSize: 10,
  },
  md: {
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.75, borderRadius: 8 },
    text: { fontSize: 11, letterSpacing: 0.4 },
    chip: { paddingHorizontal: 8, paddingVertical: 3, minHeight: 24 },
    chipText: { fontSize: 11 },
    iconSize: 12,
  },
  lg: {
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.75, borderRadius: 8 },
    text: { fontSize: 11, letterSpacing: 0.4 },
    chip: { paddingHorizontal: 8, paddingVertical: 3, minHeight: 24 },
    chipText: { fontSize: 11 },
    iconSize: 12,
  },
};

export function getTopTypeTag(product: ProductSummary, size: 'sm' | 'md' | 'lg' = 'md'): ProductTagSpec {
  if (product.isFree) {
    return { label: "Free", tone: "mint", size };
  }

  if(product.requestByMoney && product.allowTradeRequest) {
    return { label: "Cash or Trade", tone: "blue", size };
  }

  if (product.requestByMoney) {
    return { label: "Cash Only", tone: "amber", size };
  }

  return { label: "Trade Only", tone: "violet", size };
}

export function getContextTag(product: ProductSummary, isRequested: boolean): ProductTagSpec | null {
  if (product.status === "RESERVED") {
    if (product.reservationContext === "FOR_VIEWER") {
      return { key: "reserved-for-you", label: "Reserved for you", tone: "blue", icon: "lock" };
    }

    return { key: "popular-now", label: "Popular now", tone: "orange", icon: "trending-up" };
  }

  if (isRequested) {
    return { key: "requested", label: "Requested", tone: "amber", icon: "clock" };
  }

  switch (product.status) {
    case "EXCHANGED":
      return { key: "traded", label: "Traded", tone: "teal", icon: "refresh-cw" };
    case "INACTIVE":
      return { key: "paused", label: "Paused", tone: "slate", icon: "pause-circle" };
    case "REMOVED":
      return { key: "unavailable", label: "Unavailable", tone: "rose", icon: "slash" };
    default:
      return null;
  }
}

export const getStatusPillStyle = ({ status, isReported, isLive, theme }: { status: ProductSummary["status"]; isReported: boolean; isLive: boolean; theme: any }) => {
  if (isReported || status === "REPORTED") {
    return {
      bg: "#fee2e2",
      border: "#fda4af",
      text: "#b91c1c",
    };
  }
  if (isLive || status === "RESERVED") {
    return {
      bg: "#dcfce7",
      border: "#86efac",
      text: "#15803d",
    };
  }
  // if () {
  //   return {
  //     bg: "#dbeafe",
  //     border: "#93c5fd",
  //     text: "#1d4ed8",
  //   };
  // }
  // INACTIVE and fallback
  return {
    bg: theme.colors.surfaceMuted,
    border: theme.colors.border,
    text: theme.colors.textMuted,
  };
};

export function ProductTag({
  tag,
  variant,
  style,
}: {
  tag: ProductTagSpec;
  variant: "top-text" | "bottom-chip";
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppTheme();
  const mode = theme.mode === "dark" ? "dark" : "light";
  const palette = variant === "top-text" ? TAG_TONES[tag.tone].top[mode] : TAG_TONES[tag.tone].bottom[mode];
  const sz = SIZE_STYLES[tag.size ?? "md"];

  if (variant === "top-text") {
    return (
      <View
        style={[
          styles.topTypeBadge,
          sz.badge,
          { borderColor: palette.border, backgroundColor: palette.bg },
          style,
        ]}
      >
        <Text style={[styles.topTypeText, sz.text, { color: palette.text }]} numberOfLines={1}>
          {tag.label}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bottomTag,
        sz.chip,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      {tag.icon ? <Feather name={tag.icon} size={sz.iconSize} color={palette.text} /> : null}
      <Text style={[styles.bottomTagText, sz.chipText, { color: palette.text }]} numberOfLines={1}>
        {tag.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topTypeBadge: {
    maxWidth: 148,
    borderWidth: 1.75,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  topTypeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bottomTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: "flex-start",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 24,
    maxWidth: 170,
  },
  bottomTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
});