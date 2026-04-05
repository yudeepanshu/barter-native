import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface RangeSliderProps {
  minimumValue: number;
  maximumValue: number;
  value: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: StyleProp<ViewStyle>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function RangeSlider({
  minimumValue,
  maximumValue,
  value,
  step = 1,
  disabled = false,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = "#2563eb",
  maximumTrackTintColor = "#cbd5e1",
  thumbTintColor = "#2563eb",
  style,
}: RangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const safeMin = Math.min(minimumValue, maximumValue);
  const safeMax = Math.max(minimumValue, maximumValue);
  const range = Math.max(safeMax - safeMin, 1);
  const [internalValue, setInternalValue] = useState(() => clamp(value, safeMin, safeMax));
  const dragStartValueRef = useRef(internalValue);
  const internalValueRef = useRef(internalValue);
  const trackWidthRef = useRef(trackWidth);
  const safeMinRef = useRef(safeMin);
  const safeMaxRef = useRef(safeMax);
  const rangeRef = useRef(range);
  const stepRef = useRef(step);
  const disabledRef = useRef(disabled);
  const onValueChangeRef = useRef(onValueChange);
  const onSlidingCompleteRef = useRef(onSlidingComplete);

  useEffect(() => {
    if (!isDragging) {
      setInternalValue(clamp(value, safeMin, safeMax));
    }
  }, [isDragging, safeMax, safeMin, value]);

  useEffect(() => {
    internalValueRef.current = internalValue;
  }, [internalValue]);

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);

  useEffect(() => {
    safeMinRef.current = safeMin;
    safeMaxRef.current = safeMax;
    rangeRef.current = range;
    stepRef.current = step;
    disabledRef.current = disabled;
    onValueChangeRef.current = onValueChange;
    onSlidingCompleteRef.current = onSlidingComplete;
  }, [disabled, onSlidingComplete, onValueChange, range, safeMax, safeMin, step]);

  const ratio = (internalValue - safeMin) / range;

  const normalize = (next: number) => {
    const stepped = Math.round(next / stepRef.current) * stepRef.current;
    return clamp(stepped, safeMinRef.current, safeMaxRef.current);
  };

  const setNextValue = (next: number) => {
    const normalized = normalize(next);
    if (normalized !== internalValueRef.current) {
      internalValueRef.current = normalized;
      setInternalValue(normalized);
      onValueChangeRef.current(normalized);
    }
    return normalized;
  };

  const updateFromDx = (dx: number) => {
    if (disabledRef.current || trackWidthRef.current <= 0) {
      return;
    }

    const raw = dragStartValueRef.current + (dx / trackWidthRef.current) * rangeRef.current;
    return setNextValue(raw);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: (_, gestureState) => {
          setIsDragging(true);
          dragStartValueRef.current = internalValueRef.current;
          if (gestureState.dx !== 0) {
            updateFromDx(gestureState.dx);
          }
        },
        onPanResponderMove: (_, gestureState) => {
          updateFromDx(gestureState.dx);
        },
        onPanResponderRelease: (_, gestureState) => {
          const finalValue = updateFromDx(gestureState.dx) ?? internalValueRef.current;
          setIsDragging(false);
          onSlidingCompleteRef.current?.(finalValue);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          onSlidingCompleteRef.current?.(internalValueRef.current);
        },
      }),
    [],
  );

  return (
    <View
      style={[styles.root, style, disabled ? styles.rootDisabled : null]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== trackWidth) {
          setTrackWidth(width);
        }
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]}>
        <View style={[styles.fill, { backgroundColor: minimumTrackTintColor, width: `${ratio * 100}%` }]} />
      </View>
      <View
        style={[
          styles.thumb,
          {
            left: `${ratio * 100}%`,
            backgroundColor: thumbTintColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 28,
    justifyContent: "center",
  },
  rootDisabled: {
    opacity: 0.7,
  },
  track: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  thumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    top: "50%",
    marginTop: -9,
    marginLeft: -9,
    elevation: 1,
  },
});
