import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { SmoothCollapse } from "./SmoothCollapse";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  themeColors: {
    textPrimary: string;
    textSecondary: string;
    surface: string;
    border: string;
  };
  maxHeight?: number;
  testID?: string;
  rightElement?: React.ReactNode;
  subtitle?: string;
  leftElement?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  themeColors,
  maxHeight = 500,
  testID,
  rightElement,
  subtitle,
  leftElement,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={[styles.container, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        style={[styles.header, { borderBottomWidth: expanded ? 1 : 0, borderColor: themeColors.border }]}
        testID={testID}
      >
        {leftElement ? <View style={styles.headerLeading}>{leftElement}</View> : null}
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {rightElement ?? null}
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={themeColors.textSecondary}
          />
        </View>
      </Pressable>

      <SmoothCollapse expanded={expanded} maxHeight={maxHeight}>
        <View style={styles.content}>{children}</View>
      </SmoothCollapse>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  headerLeading: {
    marginRight: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
});
