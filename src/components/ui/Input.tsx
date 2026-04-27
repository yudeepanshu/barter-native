import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useKeyboardAwareInput } from "@/components/layout/KeyboardAwareContext";

interface InputProps extends Omit<ComponentProps<typeof TextInput>, "style"> {
  label?: string;
  error?: string | null;
  style?: ComponentProps<typeof TextInput>["style"];
  showCharacterCount?: boolean;
  disabled?: boolean;
}

export function Input({
  label,
  error,
  style,
  showCharacterCount = false,
  disabled = false,
  editable,
  onChangeText,
  onFocus,
  onBlur, 
  ...rest
}: InputProps) {
  const { theme } = useAppTheme();
  const keyboardAware = useKeyboardAwareInput();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const currentValue =
    typeof rest.value === "string"
      ? rest.value
      : rest.value != null
      ? String(rest.value)
      : "";

  const maxLength =
    typeof rest.maxLength === "number" ? rest.maxLength : null;

  const isNumeric = rest.keyboardType === "numeric" || rest.keyboardType === "number-pad" || rest.keyboardType === "phone-pad";

  return (
    <View style={styles.container}>
      <View style={[styles.stickyContent]}>
        {label && (
          <Text
            style={[styles.label, { color: theme.colors.textSecondary }]}
          >
            {label}
          </Text>
        )}

        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: disabled ? theme.colors.textMuted : theme.colors.textPrimary,
              backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.surface,
              borderColor: disabled
                ? theme.colors.border
                : focused
                ? theme.colors.primary
                : theme.colors.border,
              borderRadius: theme.roundness - 4,
              opacity: disabled ? 0.7 : 1,
            },
            error && !disabled && { borderColor: theme.colors.danger },
            style,
          ]}
          editable={!disabled}
            onChangeText={(value) => {
              const next = isNumeric ? value.replace(/[^0-9]/g, "") : value;
              onChangeText?.(next);
            }}
          onFocus={(event) => {
            setFocused(true);
            keyboardAware?.notifyInputFocused(inputRef.current);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />

        {showCharacterCount && maxLength != null && (
          <Text
            style={[
              styles.characterCount,
              { color: theme.colors.textMuted },
            ]}
          >
            {currentValue.length}/{maxLength}
          </Text>
        )}

        {error && (
          <Text
            style={[styles.errorText, { color: theme.colors.danger }]}
          >
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  stickyContent: { gap: 4 },
  focusedLayer: {
    zIndex: 40,
    elevation: 40,
  },
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
  characterCount: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "right",
    marginTop: 2,
  },
});