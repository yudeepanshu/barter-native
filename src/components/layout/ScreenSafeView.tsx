import { initialWindowMetrics } from "react-native-safe-area-context";
import { View, StyleSheet, type ViewProps } from "react-native";
import type { PropsWithChildren } from "react";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ScreenSafeViewProps extends PropsWithChildren {
  style?: ViewProps["style"];
}

const TOP_INSET = initialWindowMetrics!.insets.top;

/**
 * Drop-in replacement for <SafeAreaView edges={["top"]}>.
 *
 * Uses `initialWindowMetrics` to apply the top inset synchronously on the
 * first render, preventing the jitter caused by SafeAreaView measuring the
 * inset asynchronously and shifting content down after mount.
 *
 * Usage:
 *   <ScreenSafeView style={{ backgroundColor: theme.colors.background }}>
 *     ...
 *   </ScreenSafeView>
 */
export function ScreenSafeView({ children, style }: ScreenSafeViewProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.colors.background, paddingTop: TOP_INSET },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});