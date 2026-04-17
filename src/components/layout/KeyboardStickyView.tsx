import {
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardMetrics } from "@/hooks/useKeyboardMetrics";

interface KeyboardStickyViewProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  bottomOffset?: number;
}

export function KeyboardStickyView({
  children,
  style,
  bottomOffset = 0,
}: KeyboardStickyViewProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardMetrics();

  const animatedOffset = useRef(new Animated.Value(0)).current;
  const previousOffsetRef = useRef(0);

  const targetOffset = useMemo(() => {
    if (!keyboard.isVisible) return 0;

    const safeInset = Platform.OS === "ios" ? insets.bottom : 0;
    return Math.max(0, keyboard.height - safeInset);
  }, [insets.bottom, keyboard.height, keyboard.isVisible]);

  useEffect(() => {
    const prev = previousOffsetRef.current;

    // ✅ Skip tiny or no-op updates (prevents jitter)
    if (Math.abs(prev - targetOffset) < 2) {
      return;
    }

    previousOffsetRef.current = targetOffset;

    Animated.timing(animatedOffset, {
      toValue: targetOffset,
      duration: keyboard.animationDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animatedOffset, keyboard.animationDuration, targetOffset]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          paddingBottom: insets.bottom + bottomOffset,
          transform: [
            {
              translateY: Animated.multiply(animatedOffset, -1),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});