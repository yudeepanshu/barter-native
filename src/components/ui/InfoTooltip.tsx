import React, { useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";

interface InfoTooltipProps {
  /** Tooltip text shown when the trigger is pressed. */
  text: string;
  /** Custom trigger element. Defaults to an info circle icon when omitted. */
  children?: React.ReactNode;
  /** Size of the default info icon (ignored when children is provided). */
  iconSize?: number;
  /** Color of the default info icon (ignored when children is provided). */
  iconColor?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  children,
  iconSize = 16,
  iconColor,
}) => {
  const { theme } = useAppTheme();

  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);

  const triggerRef = useRef<View>(null);

  const open = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const resolvedIconColor = iconColor ?? theme.colors.textMuted;

  return (
    <>
      <Pressable ref={triggerRef} onPress={open} hitSlop={8} accessibilityRole="button" accessibilityLabel="More info">
        {children ?? (
          <Feather name="info" size={iconSize} color={resolvedIconColor} />
        )}
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
            <View
                style={[
                styles.tooltip,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                },
                anchor ? {
                    top: anchor.y + anchor.height + 6,
                    left: Math.max(12, anchor.x - 80)
                    } : undefined,
                ]}
            >
                <Text
                    style={[
                        styles.tooltipText,
                        { color: theme.colors.textPrimary },
                    ]}
                    >
                    {text}
                </Text>
            </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  tooltip: {
    position: "absolute",
    maxWidth: 260,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  tooltipText: {
    fontSize: 13,
    lineHeight: 18,
  },
});