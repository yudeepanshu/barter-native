import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useState } from "react";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AnchoredContextMenu, type AnchoredContextMenuItem, type ContextMenuAnchor } from "./AnchoredContextMenu";

interface BackMenuHeaderProps {
  title?: string;
  onBack: () => void;
  onMenuPress?: () => void;
  textColor?: string;
  titleNode?: ReactNode;
  contextMenuItems?: AnchoredContextMenuItem[];
}

export function MenuHeader({
  title,
  onBack,
  onMenuPress,
  textColor = "#111827",
  contextMenuItems,
}: BackMenuHeaderProps) {
  const { theme } = useAppTheme();
  const [contextMenuAnchor, setContextMenuAnchor] = useState<ContextMenuAnchor | null>(null);

  const hasContextMenuItems = (contextMenuItems?.length ?? 0) > 0;
  const hasMenuButton = hasContextMenuItems || typeof onMenuPress === "function";

  const handleMenuPress = (event: GestureResponderEvent) => {
    if (hasContextMenuItems) {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      const buttonLeft = pageX - locationX;
      const buttonTop = pageY - locationY;
      const buttonSize = 32;

      setContextMenuAnchor({
        left: buttonLeft,
        top: buttonTop,
        bottom: buttonTop + buttonSize,
      });
      return;
    }

    if (onMenuPress) {
      onMenuPress();
    }
  };

  const closeContextMenu = () => {
    setContextMenuAnchor(null);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1, borderColor: theme.colors.border }]}
      >
        <Feather name="chevron-left" size={20} color={textColor} />
        {title ? <Text style={[styles.title, { color: textColor }]}>{title}</Text> : null}
      </Pressable>

      {hasMenuButton ? (
        <Pressable
          onPress={handleMenuPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1, borderColor: theme.colors.border }]}
        >
          <Feather name="more-vertical" size={20} color={textColor} />
        </Pressable>
      ) : null}

      {hasContextMenuItems ? (
        <AnchoredContextMenu
          visible={Boolean(contextMenuAnchor)}
          anchor={contextMenuAnchor}
          onClose={closeContextMenu}
          items={contextMenuItems ?? []}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
  },
  title: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: "700",
  },
});
