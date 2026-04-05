import { Pressable, StyleSheet, Text } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface FormCategoryChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FormCategoryChip({ label, active, onPress }: FormCategoryChipProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable onPress={onPress}>
      <Text
        style={[
          styles.chip,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.textSecondary,
          },
          active
            ? {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.primary,
                color: theme.colors.onPrimary,
              }
            : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: "600",
    fontSize: 12,
  },
});
