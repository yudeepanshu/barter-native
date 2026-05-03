import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { type ProductTagSpec, TAG_TONES } from "./ProductTags";

interface ProductContextBadgeProps {
  tag: ProductTagSpec;
  position?: "left" | "right";
}

export function ProductContextBadge({ tag, position = "left" }: ProductContextBadgeProps) {
  const { theme } = useAppTheme();
  const mode = theme.mode === "dark" ? "dark" : "light";
  const borderColor = TAG_TONES[tag.tone].top[mode].border;

  return (
    <View style={[styles.badge, position === "left" ? styles.left : styles.right, { borderLeftColor: borderColor }]}>
      {tag.icon ? <Feather name={tag.icon} size={11} color={borderColor} /> : null}
      <Text style={styles.label} numberOfLines={1}>
        {tag.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 0,
    borderLeftWidth: 3,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: "80%",
  },
  left: {
    left: 8,
  },
  right: {
    right: 8,
  },
  label: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});