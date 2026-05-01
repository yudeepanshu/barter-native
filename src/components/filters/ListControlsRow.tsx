import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRef } from "react";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ContextMenuAnchor } from "@/components/ui/AnchoredContextMenu";

interface ListControlsRowProps {
  activeFilterCount: number;
  freeOnly: boolean;
  sortActive?: boolean;
  onOpenFilters: () => void;
  onOpenSort?: () => void;
  onToggleFree?: () => void;
  onFilterAnchor?: (anchor: ContextMenuAnchor) => void;
  onSortAnchor?: (anchor: ContextMenuAnchor) => void;
  showSort?: boolean;
  showFree?: boolean;
  filterLabel?: string;
}

export function ListControlsRow({
  activeFilterCount,
  freeOnly,
  sortActive = false,
  onOpenFilters,
  onOpenSort,
  onToggleFree,
  onFilterAnchor,
  onSortAnchor,
  showSort = true,
  showFree = true,
  filterLabel = "Filters",
}: ListControlsRowProps) {
  const { theme } = useAppTheme();
  const filterButtonRef = useRef<any>(null);
  const sortButtonRef = useRef<any>(null);

  const handleOpenFilters = () => {
    if (filterButtonRef.current?.measureInWindow) {
      filterButtonRef.current.measureInWindow((left: number, top: number, width: number, height: number) => {
        onFilterAnchor?.({ left, top, bottom: top + height });
        onOpenFilters();
      });
      return;
    }

    onOpenFilters();
  };

  const handleOpenSort = () => {
    if (sortButtonRef.current?.measureInWindow) {
      sortButtonRef.current.measureInWindow((left: number, top: number, width: number, height: number) => {
        onSortAnchor?.({ left, top, bottom: top + height });
        onOpenSort?.();
      });
      return;
    }

    onOpenSort?.();
  };

  return (
    <View style={styles.controlsWrap}>
      <Pressable
        ref={filterButtonRef}
        onPress={handleOpenFilters}
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
          ref={sortButtonRef}
          onPress={handleOpenSort}
          style={[
            styles.controlButton,
            {
              borderColor: sortActive ? theme.colors.primary : theme.colors.border,
              backgroundColor: sortActive ? theme.colors.chipActiveBg : theme.colors.surface,
            },
          ]}
        >
          <Feather
            name="repeat"
            size={15}
            color={sortActive ? theme.colors.chipActiveText : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.controlButtonText,
              { color: sortActive ? theme.colors.chipActiveText : theme.colors.textPrimary },
            ]}
          >
            Sort
          </Text>
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
          <MaterialCommunityIcons
            name="hand-heart"
            size={16}
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
