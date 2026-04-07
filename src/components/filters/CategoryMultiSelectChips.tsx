import { View, type StyleProp, type ViewStyle } from "react-native";
import { FilterChip } from "@/components/filters/FilterChip";

interface CategoryOption {
  id: string;
  name: string;
}

interface CategoryMultiSelectChipsProps {
  categories: CategoryOption[];
  selectedIds: string[];
  onChangeSelectedIds: (nextIds: string[]) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function CategoryMultiSelectChips({
  categories,
  selectedIds,
  onChangeSelectedIds,
  containerStyle,
}: CategoryMultiSelectChipsProps) {
  const onToggleCategory = (categoryId: string) => {
    if (selectedIds.includes(categoryId)) {
      onChangeSelectedIds(selectedIds.filter((id) => id !== categoryId));
      return;
    }

    onChangeSelectedIds([...selectedIds, categoryId]);
  };

  return (
    <View style={containerStyle}>
      <FilterChip active={selectedIds.length === 0} label="All" onPress={() => onChangeSelectedIds([])} />
      {categories.map((category) => (
        <FilterChip
          key={category.id}
          active={selectedIds.includes(category.id)}
          label={category.name}
          onPress={() => onToggleCategory(category.id)}
        />
      ))}
    </View>
  );
}