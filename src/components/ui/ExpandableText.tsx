import React, { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ExpandableTextProps {
  text: string;
  numberOfLines: number;
  style?: StyleProp<TextStyle>;
  expandColor?: string;
}

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  numberOfLines,
  style,
  expandColor,
}) => {
  const { theme } = useAppTheme();
  const [isTruncated, setIsTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const linkColor = expandColor ?? theme.colors.primary;

  return (
    <View style={styles.wrap}>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={(e) => {
          // Only update on the constrained (non-expanded) measurement
          if (!expanded) {
            setIsTruncated(e.nativeEvent.lines.length >= numberOfLines);
          }
        }}
      >
        {text}
      </Text>

      {(isTruncated || expanded) && (
        <Text
          style={[styles.toggle, { color: linkColor }]}
          onPress={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "View less" : "View more"}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  toggle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
});