import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface OtpCodeFieldProps {
  value: string;
  onChangeText?: (nextValue: string) => void;
  length?: number;
  editable?: boolean;
  active?: boolean;
  autoFocus?: boolean;
}

export function OtpCodeField({
  value,
  onChangeText,
  length = 6,
  editable = true,
  active = true,
  autoFocus = false,
}: OtpCodeFieldProps) {
  const { theme } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const normalizedValue = value.replace(/\D+/g, "").slice(0, length);
  const chars = Array.from({ length }, (_, index) => normalizedValue[index] ?? "");

  useEffect(() => {
    if (!editable || !autoFocus) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [autoFocus, editable]);

  const canFocus = editable && Boolean(onChangeText);

  return (
    <>
      <Pressable
        onPress={() => {
          if (canFocus) {
            inputRef.current?.focus();
          }
        }}
        disabled={!canFocus}
        style={styles.otpRow}
      >
        {chars.map((char, index) => {
          const filled = char.length > 0;
          const highlighted = active && (filled || index === normalizedValue.length);
          return (
            <View key={index} style={styles.otpCell}>
              <Text style={[styles.otpDigit, { color: theme.colors.textPrimary }]}>{char || " "}</Text>
              <View
                style={[
                  styles.otpUnderline,
                  {
                    backgroundColor: highlighted ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </Pressable>

      {canFocus ? (
        <TextInput
          ref={inputRef}
          value={normalizedValue}
          onChangeText={(next) => {
            if (!onChangeText) {
              return;
            }
            onChangeText(next.replace(/\D+/g, "").slice(0, length));
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          style={styles.hiddenOtpInput}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  otpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
  },
  otpCell: {
    width: 34,
    alignItems: "center",
    gap: 8,
  },
  otpDigit: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    minHeight: 32,
  },
  otpUnderline: {
    width: "100%",
    height: 2,
    borderRadius: 999,
  },
  hiddenOtpInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});