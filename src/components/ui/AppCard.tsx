import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface AppCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export function AppCard({ title, subtitle, rightSlot, children }: AppCardProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.roundness,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
          {rightSlot}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerText: { flex: 1, gap: 4 },
  title: { fontSize: 20, fontWeight: "800", lineHeight: 24 },
  subtitle: { fontSize: 13.5, lineHeight: 19 },
});
