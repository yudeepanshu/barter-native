import { useEffect } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
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
  durationMs = 180,
  style,
}: SmoothCollapseProps) {
  const measuredHeight = useSharedValue(0);
  const animatedHeight = useSharedValue(expanded ? maxHeight : 0);

  const animateTo = (nextHeight: number) => {
    cancelAnimation(animatedHeight);
    animatedHeight.value = withTiming(nextHeight, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  };

  useEffect(() => {
    const targetHeight = expanded
      ? measuredHeight.value > 0
        ? measuredHeight.value
        : maxHeight
      : 0;

    animateTo(targetHeight);
  }, [expanded, durationMs, maxHeight, measuredHeight]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0 && Math.abs(nextHeight - measuredHeight.value) > 1) {
      const hadMeasurement = measuredHeight.value > 0;
      measuredHeight.value = nextHeight;

      if (expanded) {
        if (!hadMeasurement) {
          // First real measurement after expand: adjust with animation.
          animateTo(nextHeight);
        } else {
          // Content-driven layout updates can fire many times; avoid restarting timing animation.
          animatedHeight.value = nextHeight;
        }
      }
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      <View style={styles.inner} onLayout={handleLayout} collapsable={false}>
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
