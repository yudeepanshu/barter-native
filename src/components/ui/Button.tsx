import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Variant = "primary" | "success" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { theme } = useAppTheme();

  const labelColor =
    variant === "ghost" ? theme.colors.textSecondary : variant === "success" ? theme.colors.onSuccess : theme.colors.onPrimary;
  const loadingColor = variant === "ghost" ? theme.colors.textSecondary : labelColor;

  return (
    <Pressable
      onPress={() => {
        if (!isDisabled) {
          onPress();
        }
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      android_ripple={{ color: theme.mode === "dark" ? "rgba(148, 163, 184, 0.18)" : "rgba(15, 23, 42, 0.08)" }}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.roundness - 4,
          opacity: isDisabled ? 0.52 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        variant === "primary" && { backgroundColor: theme.colors.primary },
        variant === "success" && { backgroundColor: theme.colors.success },
        variant === "ghost" && {
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size={18} color={loadingColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  label: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
});
