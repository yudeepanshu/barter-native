import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ListControlsRowProps {
  activeFilterCount: number;
  freeOnly: boolean;
  onOpenFilters: () => void;
  onOpenSort?: () => void;
  onToggleFree?: () => void;
  showSort?: boolean;
  showFree?: boolean;
  filterLabel?: string;
}

export function ListControlsRow({
  activeFilterCount,
  freeOnly,
  onOpenFilters,
  onOpenSort,
  onToggleFree,
  showSort = true,
  showFree = true,
  filterLabel = "Filters",
}: ListControlsRowProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.controlsWrap}>
      <Pressable
        onPress={onOpenFilters}
        style={[
          styles.controlButton,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Feather name="sliders" size={15} color={theme.colors.textSecondary} />
        <Text style={[styles.controlButtonText, { color: theme.colors.textPrimary }]}>{filterLabel}</Text>
        {activeFilterCount > 0 ? (
          <View style={[styles.activeCountPill, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.activeCountText, { color: theme.colors.onPrimary }]}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </Pressable>

      {showSort ? (
        <Pressable
          onPress={onOpenSort}
          style={[
            styles.controlButton,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Feather name="repeat" size={15} color={theme.colors.textSecondary} />
          <Text style={[styles.controlButtonText, { color: theme.colors.textPrimary }]}>Sort</Text>
        </Pressable>
      ) : null}

      {showFree ? (
        <Pressable
          onPress={onToggleFree}
          style={[
            styles.controlButton,
            {
              borderColor: freeOnly ? theme.colors.primary : theme.colors.border,
              backgroundColor: freeOnly ? theme.colors.chipActiveBg : theme.colors.surface,
            },
          ]}
        >
          <Feather
            name="gift"
            size={15}
            color={freeOnly ? theme.colors.chipActiveText : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.controlButtonText,
              { color: freeOnly ? theme.colors.chipActiveText : theme.colors.textPrimary },
            ]}
          >
            Free
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controlsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 36,
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  activeCountPill: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  activeCountText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
