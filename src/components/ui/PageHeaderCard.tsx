import type { PropsWithChildren, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface PageHeaderCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PageHeaderCard({ title, subtitle, rightSlot, style, children }: PageHeaderCardProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>

      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
      ) : null}

      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rightSlot: {
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    marginTop: 10,
  },
});
