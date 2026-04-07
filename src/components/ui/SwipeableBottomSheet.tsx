import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type DimensionValue,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SwipeableBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  maxHeight?: DimensionValue;
  minHeight?: number;
}

export function SwipeableBottomSheet({
  visible,
  onClose,
  title,
  children,
  contentContainerStyle,
  sheetStyle,
  maxHeight = "82%",
  minHeight = 240,
}: SwipeableBottomSheetProps) {
  const { theme } = useAppTheme();
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);

  useEffect(() => {
    if (!visible) {
      setDragOffset(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                maxHeight,
                minHeight,
                transform: [{ translateY: dragOffset }],
              },
              sheetStyle,
            ]}
          >
            <View
              style={styles.handleRow}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={(event) => {
                const dy = event.nativeEvent.pageY - dragStartY.current;
                return dy > 4;
              }}
              onResponderGrant={(event) => {
                dragStartY.current = event.nativeEvent.pageY;
              }}
              onResponderMove={(event) => {
                const dy = event.nativeEvent.pageY - dragStartY.current;
                setDragOffset(dy > 0 ? Math.min(160, dy) : 0);
              }}
              onResponderRelease={(event) => {
                const dy = event.nativeEvent.pageY - dragStartY.current;
                if (dy > 90) {
                  onClose();
                  return;
                }
                setDragOffset(0);
              }}
              onResponderTerminate={() => {
                setDragOffset(0);
              }}
            >
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>

            {title ? (
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.content, contentContainerStyle]}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginHorizontal: 16,
    marginTop: 4,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 20,
  },
});
