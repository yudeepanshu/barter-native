import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

export type OffersValue = "cash" | "both" | "trade";

const CASH_OFFERS_OPTIONS: [
  { label: string; value: OffersValue },
  { label: string; value: OffersValue },
  { label: string; value: OffersValue }
] = [
  { label: "Cash", value: "cash" },
  { label: "Any", value: "both" },
  { label: "Trade", value: "trade" },
];

type Props = {
  value: OffersValue;
  onChange: (value: OffersValue) => void;
  minMoneyAmount: string;
  onMinMoneyAmountChange: (value: string) => void;
  minMoneyAmountError?: string | null;
};

export function OfferSegmentedControl({
  value,
  onChange,
  minMoneyAmount,
  onMinMoneyAmountChange,
  minMoneyAmountError,
}: Props) {
  const { theme } = useAppTheme();
  const showMoneyInput = value === "cash" || value === "both";

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Allowed Offers</Text>
      </View>
      <SegmentedControl
        options={CASH_OFFERS_OPTIONS}
        value={value}
        onChange={onChange}
      />
      {showMoneyInput ? (
        <CurrencyInput
          label="Amount"
          value={minMoneyAmount}
          onChange={onMinMoneyAmountChange}
          error={minMoneyAmountError}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
});