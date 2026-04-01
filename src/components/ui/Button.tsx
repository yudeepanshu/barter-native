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

  const backgroundColor =
    variant === "ghost"
      ? theme.colors.surfaceMuted
      : variant === "success"
        ? theme.colors.success
        : theme.colors.primary;
  const borderColor = variant === "ghost" ? theme.colors.border : "transparent";
  const labelColor =
    variant === "ghost"
      ? isDisabled
        ? theme.colors.textMuted
        : theme.colors.textPrimary
      : variant === "success"
        ? theme.colors.onSuccess
        : theme.colors.onPrimary;
  const loadingColor = labelColor;

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
          opacity: isDisabled ? 0.86 : pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          backgroundColor,
          borderColor,
          borderWidth: variant === "ghost" ? 1 : 0,
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
