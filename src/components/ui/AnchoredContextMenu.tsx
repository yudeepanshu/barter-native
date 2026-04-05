import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

export interface ContextMenuAnchor {
  left: number;
  top: number;
  bottom: number;
}

export interface AnchoredContextMenuItem {
  key: string;
  label: string;
  icon: FeatherIconName;
  onPress: () => void;
  destructive?: boolean;
  dividerTop?: boolean;
}

interface AnchoredContextMenuProps {
  visible: boolean;
  anchor: ContextMenuAnchor | null;
  onClose: () => void;
  items: AnchoredContextMenuItem[];
  menuWidth?: number;
  menuHeight?: number;
  edgeGap?: number;
  bottomGuard?: number;
}

export function AnchoredContextMenu({
  visible,
  anchor,
  onClose,
  items,
  menuWidth = 160,
  menuHeight = 132,
  edgeGap = 8,
  bottomGuard = 90,
}: AnchoredContextMenuProps) {
  const { theme } = useAppTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const position = useMemo(() => {
    if (!anchor) {
      return null;
    }

    const defaultLeft = anchor.left - menuWidth;
    const defaultTop = anchor.bottom;
    const overflowBottom = defaultTop + menuHeight > screenHeight - bottomGuard;
    const overflowScreen =
      defaultLeft < edgeGap ||
      defaultLeft + menuWidth > screenWidth - edgeGap ||
      defaultTop < edgeGap;

    const rawTop = overflowBottom || overflowScreen ? anchor.top - menuHeight : defaultTop;
    const rawLeft = anchor.left - menuWidth;

    return {
      top: Math.max(edgeGap, Math.min(rawTop, screenHeight - menuHeight - edgeGap)),
      left: Math.max(edgeGap, Math.min(rawLeft, screenWidth - menuWidth - edgeGap)),
    };
  }, [anchor, bottomGuard, edgeGap, menuHeight, menuWidth, screenHeight, screenWidth]);

  if (!visible || !anchor || !position || items.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.menu,
            {
              width: menuWidth,
              top: position.top,
              left: position.left,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              style={[
                styles.item,
                item.dividerTop && { borderTopWidth: 1, borderTopColor: theme.colors.border },
              ]}
              onPress={() => {
                onClose();
                item.onPress();
              }}
            >
              <Feather
                name={item.icon}
                size={16}
                color={item.destructive ? "#dc2626" : theme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.itemText,
                  { color: item.destructive ? "#dc2626" : theme.colors.textPrimary },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  itemText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
