import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ContextMenuAnchor } from "@/components/ui/AnchoredContextMenu";
import { useEffect, useMemo, useState } from "react";

interface FloatingModalProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  headerRight?: ReactNode;
  anchor?: ContextMenuAnchor | null;
  preferCenter?: boolean;
}

export function FloatingModal({ visible, title, onClose, children, headerRight, anchor, preferCenter }: FloatingModalProps) {
  const { theme } = useAppTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [panelLayout, setPanelLayout] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!visible) setPanelLayout(null);
  }, [visible]);

  const position = useMemo(() => {
    if (!anchor || preferCenter) {
      return null;
    }

    const edgeGap = 16;
    const panelWidth = Math.min(368, screenWidth - edgeGap * 2);
    const left = Math.max(edgeGap, Math.min(anchor.left, screenWidth - panelWidth - edgeGap));
    const defaultTop = anchor.bottom + 8;

    if (!panelLayout) {
      return { top: defaultTop, left, width: panelWidth };
    }

    const overflowBottom = defaultTop + panelLayout.height > screenHeight - edgeGap;
    const top = overflowBottom ? anchor.top - panelLayout.height - 8 : defaultTop;

    return {
      top: Math.max(edgeGap, Math.min(top, screenHeight - panelLayout.height - edgeGap)),
      left,
      width: panelWidth,
    };
  }, [anchor, panelLayout, screenHeight, screenWidth, preferCenter]);

  const centeredPanelWidth = Math.min(368, screenWidth - 32);

  // Reserve space for vertical padding + header so scroll area never overflows screen.
  const VERTICAL_SCREEN_PADDING = 96;
  const HEADER_HEIGHT = title || headerRight ? 52 : 0;
  const maxScrollHeight = screenHeight - VERTICAL_SCREEN_PADDING - HEADER_HEIGHT;

  const isAnchored = !preferCenter && !!anchor;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          styles.backdrop,
          { backgroundColor: theme.colors.overlay },
          isAnchored ? styles.backdropAnchor : styles.backdropCenter,
        ]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.panel,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            position ? { position: "absolute", ...position } : { width: centeredPanelWidth },
          ]}
          onPress={() => {
            // Keep modal open when tapping inside.
          }}
          onLayout={(event) => {
            if (panelLayout) return;
            const { width, height } = event.nativeEvent.layout;
            setPanelLayout({ width, height });
          }}
        >
          {(title || headerRight) ? (
            <View style={styles.headerRow}>
              {title ? <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text> : null}
              <View style={styles.headerRight}>{headerRight}</View>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                <Feather name="x" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: maxScrollHeight }}
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backdropAnchor: {
    paddingTop: 0,
  },
  backdropCenter: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  headerRight: {
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    gap: 16,
  },
});
