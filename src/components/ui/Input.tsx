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
import { getDialCode, getPhoneFlag, getPhoneMaxDigits } from "@/lib/currency";

interface InputProps extends Omit<ComponentProps<typeof TextInput>, "style"> {
  label?: string;
  error?: string | null;
  style?: ComponentProps<typeof TextInput>["style"];
  showCharacterCount?: boolean;
  disabled?: boolean;
  leftAdornment?: React.ReactNode;
  countryDialCode?: string | false;
  countryFlag?: string | false;
}

export function Input({
  label,
  error,
  style,
  leftAdornment,
  showCharacterCount = false,
  disabled = false,
  editable,
  onChangeText,
  onFocus,
  onBlur,
  countryDialCode,
  countryFlag,
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

  const isNumeric =
    rest.keyboardType === "numeric" ||
    rest.keyboardType === "number-pad" ||
    rest.keyboardType === "phone-pad";

  const isPhoneInput = rest.keyboardType === "phone-pad";

  const resolvedDialCode =
    countryDialCode === false
      ? null
      : countryDialCode ?? (isPhoneInput ? getDialCode() : null);

  const resolvedFlag =
    countryFlag === false
      ? null
      : countryFlag ?? (isPhoneInput ? getPhoneFlag() : null);

  const hasDialCode = !!resolvedDialCode;

  const resolvedMaxLength: number | null =
    typeof rest.maxLength === "number"
      ? rest.maxLength
      : isPhoneInput
      ? getPhoneMaxDigits()
      : null;

  const showMeta = (showCharacterCount && resolvedMaxLength != null) || !!error;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: disabled
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
            borderColor: disabled
              ? theme.colors.border
              : focused
              ? theme.colors.primary
              : theme.colors.border,
            borderRadius: theme.roundness - 4,
            borderWidth: 1.4,
            opacity: disabled ? 0.7 : 1,
          },
          error && !disabled && { borderColor: theme.colors.danger },
        ]}
      >
        {leftAdornment ? (
          <View style={styles.adornment}>{leftAdornment}</View>
        ) : null}

        {hasDialCode ? (
          <View
            style={[
              styles.dialCodeBadge,
              {
                borderRightColor: focused
                  ? theme.colors.primary
                  : theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
          >
            {resolvedFlag ? (
              <Text style={styles.dialCodeFlag}>{resolvedFlag}</Text>
            ) : null}
            <Text
              style={[styles.dialCodeText, { color: theme.colors.textSecondary }]}
            >
              {resolvedDialCode}
            </Text>
          </View>
        ) : null}

        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            { color: disabled ? theme.colors.textMuted : theme.colors.textPrimary },
            style,
          ]}
          editable={!disabled}
          cursorColor={theme.colors.primary}
          maxLength={resolvedMaxLength ?? undefined}
          onChangeText={(value) => {
            let next = isNumeric ? value.replace(/[^0-9]/g, "") : value;
            if (resolvedMaxLength != null) next = next.slice(0, resolvedMaxLength);
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
      </View>

      {showMeta ? (
        <View style={styles.metaRow}>
          {error && !disabled ? (
            <Text
              style={[styles.errorText, { color: theme.colors.danger }]}
              numberOfLines={2}
            >
              {error}
            </Text>
          ) : (
            <View />
          )}
          {showCharacterCount && resolvedMaxLength != null ? (
            <Text style={[styles.characterCount, { color: theme.colors.textMuted }]}>
              {currentValue.length}/{resolvedMaxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    overflow: "hidden",
  },
  adornment: {
    paddingLeft: 14,
    justifyContent: "center",
  },
  dialCodeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: 12,
    gap: 5,
    borderRightWidth: 1.4,
  },
  dialCodeFlag: {
    fontSize: 16,
    lineHeight: 20,
  },
  dialCodeText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 15.5,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  characterCount: {
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 0,
  },
});