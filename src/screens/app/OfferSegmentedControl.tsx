import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

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
        <Input
          value={minMoneyAmount}
          onChangeText={onMinMoneyAmountChange}
          keyboardType="numeric"
          placeholder="Enter minimum accepted amount (₹)"
          error={minMoneyAmountError ?? null}
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