import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { AppTheme } from "@/theme/appTheme";

type Variant = "primary" | "success" | "ghost" | "tertiary";

interface ResolvedButtonConfig {
  backgroundColor: string;
  pressedBackgroundColor: string;
  borderColor: string;
  borderWidth: number;
  labelColor: string;
  loadingColor: string;
  rippleColor: string;
}

function getButtonConfig(
  variant: Variant,
  theme: AppTheme,
  isDisabled: boolean,
  textColor?: string,
): ResolvedButtonConfig {
  const base = theme.buttons[variant];

  const labelColor = textColor ?? (isDisabled ? theme.colors.textMuted : base.labelColor);

  return {
    ...base,
    labelColor,
    loadingColor: labelColor,
    rippleColor:
      theme.mode === "dark"
        ? "rgba(148, 163, 184, 0.18)"
        : "rgba(15, 23, 42, 0.08)",
  };
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  textColor?: string;
  leftIcon?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  labelStyle,
  textColor,
  leftIcon,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { theme } = useAppTheme();

  const config = getButtonConfig(variant, theme, isDisabled, textColor);

  return (
    <Pressable
      key={`button-${label}-${variant}-${theme.mode}`}
      onPress={() => {
        if (!isDisabled) onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      android_ripple={{ color: config.rippleColor }}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.roundness - 4,
          opacity: isDisabled ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          backgroundColor: pressed
            ? config.pressedBackgroundColor
            : config.backgroundColor,
          borderColor: config.borderColor,
          borderWidth: config.borderWidth,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size={18} color={config.loadingColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
          <Text
            style={[styles.label, { color: config.labelColor }, labelStyle]}
          >
            {label}
          </Text>
        </View>
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
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
});