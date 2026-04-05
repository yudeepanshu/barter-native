import { StyleSheet, Text, View } from "react-native";
import type { ProductSummary } from "@barter/types";
import { Feather } from "@expo/vector-icons";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

export type ProductTagTone = "mint" | "amber" | "violet" | "blue" | "teal" | "slate" | "rose";

export interface ProductTagSpec {
  label: string;
  tone: ProductTagTone;
  icon?: FeatherIconName;
}

const TAG_TONES: Record<
  ProductTagTone,
  {
    top: { bg: string; border: string; text: string };
    bottom: { bg: string; border: string; text: string };
  }
> = {
  mint: {
    top: { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
    bottom: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
  },
  amber: {
    top: { bg: "#fffbeb", border: "#fbbf24", text: "#92400e" },
    bottom: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
  },
  violet: {
    top: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6" },
    bottom: { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" },
  },
  blue: {
    top: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
    bottom: { bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  },
  teal: {
    top: { bg: "#f0fdfa", border: "#5eead4", text: "#0f766e" },
    bottom: { bg: "#ccfbf1", border: "#5eead4", text: "#0f766e" },
  },
  slate: {
    top: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" },
    bottom: { bg: "#e2e8f0", border: "#cbd5e1", text: "#475569" },
  },
  rose: {
    top: { bg: "#fff1f2", border: "#fda4af", text: "#b91c1c" },
    bottom: { bg: "#fee2e2", border: "#fda4af", text: "#b91c1c" },
  },
};

export function getTopTypeTag(product: ProductSummary): ProductTagSpec {
  if (product.isFree) {
    return { label: "Free", tone: "mint" };
  }

  if (product.requestByMoney) {
    return { label: "Open for money", tone: "amber" };
  }

  return { label: "Barter only", tone: "violet" };
}

export function getContextTag(product: ProductSummary, isRequested: boolean): ProductTagSpec | null {
  if (product.status === "RESERVED") {
    if (product.reservationContext === "FOR_VIEWER") {
      return { label: "Reserved for you", tone: "blue", icon: "lock" };
    }

    return { label: "Popular now", tone: "amber", icon: "trending-up" };
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
  const palette = variant === "top-text" ? TAG_TONES[tag.tone].top : TAG_TONES[tag.tone].bottom;

  if (variant === "top-text") {
    return (
      <Text style={[styles.topTypeText, { color: palette.text }]} numberOfLines={1}>
        {tag.label}
      </Text>
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
  topTypeText: {
    maxWidth: 132,
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
    borderRadius: 999,
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
