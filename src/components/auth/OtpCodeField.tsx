import { useEffect, useRef } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface OtpCodeFieldProps {
  value: string;
  onChangeText?: (nextValue: string) => void;
  length?: number;
  editable?: boolean;
  active?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}

export function OtpCodeField({
  value,
  onChangeText,
  length = 6,
  editable = true,
  active = true,
  autoFocus = false,
  invalid = false,
}: OtpCodeFieldProps) {
  const { theme } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const cellPositionsRef = useRef<{ x: number; width: number }[]>([]);
  const normalizedValue = value.replace(/\D+/g, "").slice(0, length);
  const chars = Array.from({ length }, (_, index) => normalizedValue[index] ?? "");

  const focusInput = () => {
    inputRef.current?.focus();
    if (Platform.OS === "android") {
      // Android occasionally ignores focus when an invisible field regains focus
      // right after keyboard dismissal; re-focus in next tick to reopen keyboard.
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  };

  useEffect(() => {
    if (!editable || !autoFocus) {
      return;
    }

    const timer = setTimeout(() => {
      focusInput();
    }, 120);

    return () => clearTimeout(timer);
  }, [autoFocus, editable]);

  const canFocus = editable && Boolean(onChangeText);

  const handleCellPress = (cellIndex: number) => {
    if (canFocus) {
      focusInput();
      // Set cursor position to the clicked cell
      // Position cursor at: min(cellIndex + 1, normalizedValue.length + 1)
      const cursorPos = Math.min(cellIndex + 1, normalizedValue.length + 1);
      inputRef.current?.setSelection(cursorPos, cursorPos);
    }
  };

  const handleCellLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    cellPositionsRef.current[index] = { x, width };
  };

  return (
    <View style={styles.fieldWrap}>
      <Pressable
        onPress={() => {
          if (canFocus) {
            focusInput();
          }
        }}
        disabled={!canFocus}
        style={styles.otpRow}
      >
        {chars.map((char, index) => {
          const filled = char.length > 0;
          const highlighted = active && (filled || index === normalizedValue.length);
          return (
            <Pressable
              key={index}
              onPress={() => handleCellPress(index)}
              disabled={!canFocus}
              onLayout={(event) => handleCellLayout(index, event)}
              style={styles.otpCell}
            >
              <Text
                style={[
                  styles.otpDigit,
                  {
                    color: invalid ? theme.colors.danger : theme.colors.textPrimary,
                  },
                ]}
              >
                {char || " "}
              </Text>
              <View
                style={[
                  styles.otpUnderline,
                  {
                    backgroundColor: invalid
                      ? theme.colors.danger
                      : highlighted
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              />
            </Pressable>
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
          onBlur={() => {
            // Keep the input pressable for focus restoration
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          showSoftInputOnFocus
          contextMenuHidden
          caretHidden
          blurOnSubmit={false}
          maxLength={length}
          style={styles.hiddenOtpInput}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    width: "100%",
    alignItems: "center",
    position: "relative",
  },
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
    width: "100%",
    height: 56,
    opacity: 0,
  },
});