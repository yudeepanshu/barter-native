import { StyleSheet, View } from "react-native";
import { FilterChip } from "@/components/filters/FilterChip";

export interface OptionPillMenuItem {
  key: string;
  label: string;
  value: string;
  disabled?: boolean;
}

interface OptionPillMenuProps {
  items: OptionPillMenuItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function OptionPillMenu({ items, selectedValue, onSelect }: OptionPillMenuProps) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <FilterChip
          key={item.key}
          label={item.label}
          active={item.value === selectedValue}
          disabled={item.disabled}
          onPress={() => onSelect(item.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
