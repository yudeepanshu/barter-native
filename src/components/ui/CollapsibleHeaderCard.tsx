import type { PropsWithChildren, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SmoothCollapse } from "./SmoothCollapse";

interface CollapsibleHeaderCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  /** Icon or indicator shown to the right of the subtitle (e.g. ActivityIndicator for loading state). */
  subtitleRight?: ReactNode;
  /** Extra action buttons rendered to the left of the collapse toggle (e.g. notification bell). */
  rightActions?: ReactNode;
  footerSlot?: ReactNode;
  collapseMaxHeight?: number;
  collapseDurationMs?: number;
  defaultExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
  expanded?: boolean; // If provided, controls the expanded state from the parent instead of internally.
  onExpandedChange?: (expanded: boolean) => void; // Callback for when the expanded state changes, useful when `expanded` is controlled from the parent.
}

/**
 * A page-header card with a built-in expand/collapse toggle.
 * The expanded state is owned internally so toggling never re-renders the parent.
 */
export function CollapsibleHeaderCard({
  title,
  subtitle,
  subtitleRight,
  rightActions,
  footerSlot,
  collapseMaxHeight = 360,
  collapseDurationMs = 180,
  defaultExpanded = false,
  style,
  expanded: controlledExpanded,
  children,
  onExpandedChange,
}: CollapsibleHeaderCardProps) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (controlledExpanded !== undefined) {
      setExpanded(controlledExpanded);
    }
  }, [controlledExpanded]);

  return (
    <Pressable
      onPress={() => {
        setExpanded((v)=> !v);
        onExpandedChange?.(!expanded);
      }}
    >
    <View
      style={[
        styles.card,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightSlot}>
          {rightActions ?? null}
          <Pressable
            onPress={() => {
              setExpanded((v)=> !v);
              onExpandedChange?.(!expanded);
            }}
            style={[
              styles.toggleButton,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {subtitle ? (
        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
          {subtitleRight ?? null}
        </View>
      ) : null}

      <SmoothCollapse expanded={expanded} maxHeight={collapseMaxHeight} durationMs={collapseDurationMs}>
        <View style={styles.collapseContent}>{children}</View>
      </SmoothCollapse>
      {footerSlot ? <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>{footerSlot}</View> : null}
    </View>
    </Pressable>
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
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 29,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  subtitleRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rightSlot: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  collapseContent: {
    gap: 10,
    paddingBottom: 2,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
  },
});
