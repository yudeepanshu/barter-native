import { useEffect } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface SmoothCollapseProps {
  expanded: boolean;
  children: React.ReactNode;
  maxHeight?: number;
  durationMs?: number;
  style?: ViewStyle;
}

export function SmoothCollapse({
  expanded,
  children,
  maxHeight = 360,
  durationMs = 420,
  style,
}: SmoothCollapseProps) {
  const progress = useSharedValue(expanded ? 1 : 0);
  const measuredHeight = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: durationMs,
      easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
    });
  }, [expanded, durationMs, progress]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0 && nextHeight !== measuredHeight.value) {
      measuredHeight.value = nextHeight;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    const resolvedHeight = measuredHeight.value > 0 ? measuredHeight.value : maxHeight;

    return {
      height: interpolate(progress.value, [0, 1], [0, resolvedHeight]),
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
    };
  });

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      <View style={styles.inner} onLayout={handleLayout}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    width: "100%",
  },
  inner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
  },
});
