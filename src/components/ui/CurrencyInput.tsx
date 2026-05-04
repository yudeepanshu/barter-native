import { useState, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import {
  StyleSheet,
  Text,
} from "react-native";
import {
  formatCurrency,
  stripCurrencyFormatting,
  parseRawCurrencyInput,
  type SupportedCountry,
  getCurrencySymbol,
} from "@/lib/currency";
import { useAppTheme } from "@/hooks/useAppTheme";

type CurrencyInputProps = {
  label?: string;
  error?: string | null;
  country?: SupportedCountry;
  disabled?: boolean;
  placeholder?: string;
} & (
  | { value: number | null; onChange: (value: number | null) => void }
  | { value: string;        onChange: (value: string) => void }
);

export function CurrencyInput({
  label,
  error,
  country = "IN",
  disabled = false,
  placeholder = "0",
  value,
  onChange,
}: CurrencyInputProps) {
    const { theme } = useAppTheme();
  // Normalise to number | null internally regardless of what the parent passed
  const numericValue: number | null =
    typeof value === "string" ? parseRawCurrencyInput(value) : value;

  const [displayValue, setDisplayValue] = useState<string>(
    numericValue != null ? String(numericValue) : ""
  );
  const [isFocused, setIsFocused] = useState(false);

  // Emit back in whichever shape the parent expects
  const emit = useCallback(
    (parsed: number | null) => {
      if (typeof value === "string") {
        (onChange as (v: string) => void)(parsed != null ? String(parsed) : "");
      } else {
        (onChange as (v: number | null) => void)(parsed);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof value, onChange],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setDisplayValue(numericValue != null ? stripCurrencyFormatting(String(numericValue)) : "");
  }, [numericValue]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseRawCurrencyInput(displayValue);
    emit(parsed);
    setDisplayValue(
      parsed != null ? formatCurrency(parsed, country).replace(/[^0-9.,]/g, "") : ""
    );
  }, [displayValue, country, emit]);

  const handleChangeText = useCallback(
    (text: string) => {
      const raw = stripCurrencyFormatting(text);
      setDisplayValue(raw);
      emit(parseRawCurrencyInput(raw));
    },
    [emit],
  );

  const shownValue = isFocused
    ? displayValue
    : numericValue != null
    ? new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numericValue)
    : "";

  return (
    <Input
    label={label}
    error={error}
    disabled={disabled}
    value={shownValue}
    onChangeText={handleChangeText}
    onFocus={handleFocus}
    onBlur={handleBlur}
    keyboardType="decimal-pad"
    placeholder={placeholder}
    leftAdornment={
        <Text style={[styles.symbol, { color: theme.colors.textPrimary }]}>
        {getCurrencySymbol(country)}
        </Text>
    }
    />
  );
}

const styles = StyleSheet.create({
  symbol: {
    fontSize: 15.5,
    fontWeight: "500",
  },
});