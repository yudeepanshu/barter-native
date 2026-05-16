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
  /**
   * Pass false to suppress the dial-code badge on phone inputs.
   * Pass a string (e.g. "+1") to override the default "+91".
   * Omit entirely to get the default "🇮🇳 +91" badge on phone-pad inputs.
   */
  countryDialCode?: string | false;
  /**
   * Emoji flag paired with the dial code.
   * Pass false to hide the flag while still showing the dial code.
   * Defaults to "🇮🇳" on phone-pad inputs.
   */
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

  // Auto-show IN dial code on phone inputs unless explicitly suppressed (false).
  const resolvedDialCode =
    countryDialCode === false
      ? null
      : countryDialCode ?? (isPhoneInput ? getDialCode() : null);

  // Auto-show IN flag on phone inputs unless explicitly suppressed (false).
  const resolvedFlag =
    countryFlag === false
      ? null
      : countryFlag ?? (isPhoneInput ? getPhoneFlag() : null);

  const hasDialCode = !!resolvedDialCode;

  // For phone inputs, enforce the country's max digit length (e.g. 10 for IN).
  // An explicit maxLength prop always wins over the country default.
  const resolvedMaxLength: number | null =
    typeof rest.maxLength === "number"
      ? rest.maxLength
      : isPhoneInput
      ? getPhoneMaxDigits()
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.stickyContent}>
        {label && (
          <Text
            style={[styles.label, { color: theme.colors.textSecondary }]}
          >
            {label}
          </Text>
        )}

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
          {/* Generic left adornment */}
          {leftAdornment && (
            <View style={styles.adornment}>{leftAdornment}</View>
          )}

          {/* Dial-code badge — auto-shown on phone-pad inputs */}
          {hasDialCode && (
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
                style={[
                  styles.dialCodeText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {resolvedDialCode}
              </Text>
            </View>
          )}

          <TextInput
            ref={inputRef}
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                color: disabled
                  ? theme.colors.textMuted
                  : theme.colors.textPrimary,
              },
              style,
            ]}
            editable={!disabled}
            cursorColor={theme.colors.primary}
            // Pass resolvedMaxLength to the native input so the OS keyboard
            // disables further input once the limit is reached.
            maxLength={resolvedMaxLength ?? undefined}
            onChangeText={(value) => {
              let next = isNumeric ? value.replace(/[^0-9]/g, "") : value;
              // Belt-and-suspenders slice in case the native maxLength fires
              // after a paste or autofill that bypasses the character limit.
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

        {showCharacterCount && resolvedMaxLength != null && (
          <Text
            style={[styles.characterCount, { color: theme.colors.textMuted }]}
          >
            {currentValue.length}/{resolvedMaxLength}
          </Text>
        )}

        {error && (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
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
  // ── Dial-code badge ──────────────────────────────────────────────────────
  dialCodeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",       // full height of the row
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
  // ────────────────────────────────────────────────────────────────────────
  input: {
    flex: 1,
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