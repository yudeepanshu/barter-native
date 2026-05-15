import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          borderRadius: theme.roundness - 2,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                borderRadius: theme.roundness - 6,
                backgroundColor: isActive ? theme.colors.surface : "transparent",
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: isActive ? theme.colors.textPrimary : theme.colors.textMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 4,
    gap: 6,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});