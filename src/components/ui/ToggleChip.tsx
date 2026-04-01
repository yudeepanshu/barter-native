import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ToggleChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function ToggleChip({
  label,
  selected,
  onPress,
  disabled = false,
  style,
  textStyle,
}: ToggleChipProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        style,
        {
          borderRadius: theme.roundness - 4,
          borderColor: selected ? theme.colors.chipActiveBg : theme.colors.border,
          backgroundColor: selected ? theme.colors.chipActiveBg : theme.colors.chipBg,
          opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          textStyle,
          {
            color: selected ? theme.colors.chipActiveText : theme.colors.chipText,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
