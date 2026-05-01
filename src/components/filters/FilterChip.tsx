import { Pressable, StyleSheet, Text } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function FilterChip({ label, active, onPress, disabled = false }: FilterChipProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.colors.chipActiveBg : theme.colors.border,
          backgroundColor: active ? theme.colors.chipActiveBg : theme.colors.chipBg,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: active ? theme.colors.chipActiveText : theme.colors.chipText }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    maxWidth: 160,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
