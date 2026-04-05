import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type ViewStyle } from "react-native";

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
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: durationMs,
      easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
      useNativeDriver: false,
    }).start();
  }, [durationMs, expanded, progress]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          maxHeight: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, maxHeight],
          }),
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
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
    overflow: "hidden",
  },
});
