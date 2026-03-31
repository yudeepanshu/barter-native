import type { ComponentProps } from "react";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface InputProps extends Omit<ComponentProps<typeof TextInput>, "style"> {
  label: string;
  error?: string | null;
  style?: ComponentProps<typeof TextInput>["style"];
}

export function Input({ label, error, style, ...rest }: InputProps) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
            borderColor: focused ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.roundness - 4,
          },
          Boolean(error) && { borderColor: theme.colors.danger },
          style,
        ]}
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        {...rest}
      />
      {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  input: {
    minHeight: 50,
    borderWidth: 1.4,
    paddingHorizontal: 14,
    fontSize: 15.5,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
