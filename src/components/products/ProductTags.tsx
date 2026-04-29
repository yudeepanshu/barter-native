import { StyleSheet, Text, View } from "react-native";
import type { ProductSummary } from "@barter/types";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

export type ProductTagTone = "mint" | "amber" | "violet" | "blue" | "teal" | "slate" | "rose" | "orange";

export interface ProductTagSpec {
  label: string;
  tone: ProductTagTone;
  icon?: FeatherIconName;
}

const TAG_TONES: Record<
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

export function getTopTypeTag(product: ProductSummary): ProductTagSpec {
  if (product.isFree) {
    return { label: "Free", tone: "mint" };
  }

  if (product.requestByMoney) {
    return { label: "Cash or Trade", tone: "amber" };
  }

  return { label: "Trade Only", tone: "violet" };
}

export function getContextTag(product: ProductSummary, isRequested: boolean): ProductTagSpec | null {
  if (product.status === "RESERVED") {
    if (product.reservationContext === "FOR_VIEWER") {
      return { label: "Reserved for you", tone: "blue", icon: "lock" };
    }

    return { label: "Popular now", tone: "orange", icon: "trending-up" };
  }

  if (isRequested) {
    return { label: "Requested", tone: "amber", icon: "clock" };
  }

  switch (product.status) {
    case "EXCHANGED":
      return { label: "Exchanged", tone: "teal", icon: "refresh-cw" };
    case "INACTIVE":
      return { label: "Paused", tone: "slate", icon: "pause-circle" };
    case "REMOVED":
      return { label: "Unavailable", tone: "rose", icon: "slash" };
    default:
      return null;
  }
}

export function ProductTag({ tag, variant }: { tag: ProductTagSpec; variant: "top-text" | "bottom-chip" }) {
  const { theme } = useAppTheme();
  const mode = theme.mode === "dark" ? "dark" : "light";
  const palette = variant === "top-text" ? TAG_TONES[tag.tone].top[mode] : TAG_TONES[tag.tone].bottom[mode];

  if (variant === "top-text") {
    return (
      <View
        style={[
          styles.topTypeBadge,
          {
            borderColor: palette.border,
            backgroundColor: palette.bg,
          },
        ]}
      >
        <Text style={[styles.topTypeText, { color: palette.text }]} numberOfLines={1}>
          {tag.label}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bottomTag,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
    >
      {tag.icon ? <Feather name={tag.icon} size={12} color={palette.text} /> : null}
      <Text style={[styles.bottomTagText, { color: palette.text }]} numberOfLines={1}>
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
