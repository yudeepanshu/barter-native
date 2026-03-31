import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export function Spinner({ size = 24 }: { size?: number }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.center}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
