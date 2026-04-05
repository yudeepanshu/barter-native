import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export type SortOrder = "nearest" | "newest" | "oldest";

interface SortBottomSheetProps {
  visible: boolean;
  value: SortOrder;
  onClose: () => void;
  onChange: (value: SortOrder) => void | Promise<void>;
  canUseNearest?: boolean;
  title?: string;
}

export function SortBottomSheet({
  visible,
  value,
  onClose,
  onChange,
  canUseNearest = true,
  title = "Sort by",
}: SortBottomSheetProps) {
  const { theme } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
          onPress={() => {
            // Keep sheet open when tapping inside.
          }}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable
            style={[
              styles.option,
              {
                borderColor: theme.colors.border,
                backgroundColor: value === "nearest" ? theme.colors.surfaceMuted : theme.colors.surface,
                opacity: canUseNearest ? 1 : 0.45,
              },
            ]}
            onPress={() => {
              if (!canUseNearest) {
                return;
              }
              void onChange("nearest");
              onClose();
            }}
          >
            <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>Nearest first</Text>
            {value === "nearest" ? <Feather name="check" size={16} color={theme.colors.primary} /> : null}
          </Pressable>

          <Pressable
            style={[
              styles.option,
              {
                borderColor: theme.colors.border,
                backgroundColor: value === "newest" ? theme.colors.surfaceMuted : theme.colors.surface,
              },
            ]}
            onPress={() => {
              void onChange("newest");
              onClose();
            }}
          >
            <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>Newest first</Text>
            {value === "newest" ? <Feather name="check" size={16} color={theme.colors.primary} /> : null}
          </Pressable>

          <Pressable
            style={[
              styles.option,
              {
                borderColor: theme.colors.border,
                backgroundColor: value === "oldest" ? theme.colors.surfaceMuted : theme.colors.surface,
              },
            ]}
            onPress={() => {
              void onChange("oldest");
              onClose();
            }}
          >
            <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>Oldest first</Text>
            {value === "oldest" ? <Feather name="check" size={16} color={theme.colors.primary} /> : null}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
});
