import React, { useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface TruncatedTooltipTextProps {
  text: string;
  numberOfLines: number;
  style?: StyleProp<TextStyle>;
}

export const TruncatedTooltipText: React.FC<TruncatedTooltipTextProps> = ({
  text,
  numberOfLines,
  style,
}) => {
  const { theme } = useAppTheme();
  const [isTruncated, setIsTruncated] = useState(false);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const triggerRef = useRef<View>(null);

  const open = useCallback(() => {
    if (!isTruncated) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  }, [isTruncated]);

  return (
    <>
      <Pressable ref={triggerRef} onPress={open} style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={style}
          numberOfLines={numberOfLines}
          ellipsizeMode="tail"
          onTextLayout={(e) => {
            setIsTruncated(e.nativeEvent.lines.length >= numberOfLines);
          }}
        >
          {text}
        </Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View
            style={[
              styles.tooltip,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
              anchor
                ? { top: anchor.y + anchor.height + 6, left: Math.max(12, anchor.x - 80) }
                : undefined,
            ]}
          >
            <Text style={[styles.tooltipText, { color: theme.colors.textPrimary }]}>
              {text}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  tooltip: {
    position: "absolute",
    maxWidth: 280,
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
  tooltipText: { fontSize: 13, lineHeight: 18 },
});