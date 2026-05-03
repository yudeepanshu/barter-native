import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

export type SegmentedControlOption<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  options: [SegmentedControlOption<T>, SegmentedControlOption<T>] | [SegmentedControlOption<T>, SegmentedControlOption<T>, SegmentedControlOption<T>];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { theme } = useAppTheme();
  const selectedIndex = options.findIndex((o) => o.value === value);
  const animatedIndex = useRef(new Animated.Value(selectedIndex === -1 ? 0 : selectedIndex)).current;

  useEffect(() => {
    const index = options.findIndex((o) => o.value === value);
    if (index !== -1) {
      Animated.spring(animatedIndex, {
        toValue: index,
        useNativeDriver: false,
        tension: 280,
        friction: 26,
      }).start();
    }
  }, [value, options, animatedIndex]);

  const segmentCount = options.length;
  const segmentWidthPercent = 100 / segmentCount;

  const leftPercent = animatedIndex.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => `${i * segmentWidthPercent}%`),
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {/* Sliding thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            width: `${segmentWidthPercent}%` as any,
            left: leftPercent,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      />

      {/* Option labels */}
      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, { width: `${segmentWidthPercent}%` as any }]}
            hitSlop={4}
          >
            <Text
              style={[
                styles.label,
                isActive
                  ? { color: theme.colors.textPrimary, fontWeight: "600" }
                  : { color: theme.colors.textSecondary, fontWeight: "500" },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    position: "relative",
    height: 38,
    alignItems: "center",
  },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    borderRadius: 7,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segment: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    height: "100%",
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
  },
});