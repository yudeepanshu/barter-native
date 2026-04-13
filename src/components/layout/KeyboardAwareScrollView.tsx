import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type TextInput,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardMetrics } from "@/hooks/useKeyboardMetrics";
import {
  KeyboardAwareContext,
  type KeyboardAwareContextValue,
} from "@/components/layout/KeyboardAwareContext";

interface KeyboardAwareScrollViewProps extends PropsWithChildren {
  containerStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  keyboardVerticalOffset?: number;
  keyboardDismissMode?: ScrollViewProps["keyboardDismissMode"];
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  refreshControl?: ScrollViewProps["refreshControl"];
  extraBottomPadding?: number;
  extraScrollPadding?: number;
  androidKeyboardHandling?: "auto" | "resize" | "pan";
  autoScrollToFocusedInput?: boolean;
}

export function KeyboardAwareScrollView({
  children,
  containerStyle,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  keyboardDismissMode,
  keyboardShouldPersistTaps = "handled",
  refreshControl,
  extraBottomPadding = 12,
  extraScrollPadding = 10,
  androidKeyboardHandling = "auto",
  autoScrollToFocusedInput = true,
}: KeyboardAwareScrollViewProps) {
  const behavior: KeyboardAvoidingViewProps["behavior"] = Platform.OS === "ios" ? "padding" : "height";
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const keyboard = useKeyboardMetrics();
  const scrollRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const scrollOffsetYRef = useRef(0);
  const baselineWindowHeightRef = useRef(windowDimensions.height);

  useEffect(() => {
    if (!keyboard.isVisible) {
      baselineWindowHeightRef.current = windowDimensions.height;
    }
  }, [keyboard.isVisible, windowDimensions.height]);

  const isAndroidResizeActive = useMemo(() => {
    if (Platform.OS !== "android") {
      return false;
    }
    if (androidKeyboardHandling === "resize") {
      return true;
    }
    if (androidKeyboardHandling === "pan") {
      return false;
    }
    return baselineWindowHeightRef.current - windowDimensions.height > 60;
  }, [androidKeyboardHandling, windowDimensions.height]);

  const effectiveKeyboardInset = useMemo(() => {
    if (!keyboard.isVisible) {
      return 0;
    }

    if (Platform.OS === "android" && isAndroidResizeActive) {
      return 0;
    }

    const safeInset = Platform.OS === "ios" ? insets.bottom : 0;
    return Math.max(0, keyboard.height - safeInset);
  }, [insets.bottom, isAndroidResizeActive, keyboard.height, keyboard.isVisible]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const ensureFocusedInputVisible = useCallback(
    (targetInput?: TextInput | null) => {
      if (!autoScrollToFocusedInput) {
        return;
      }

      const input = targetInput ?? focusedInputRef.current;
      const scroll = scrollRef.current;
      if (!input || !scroll) {
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          input.measureInWindow((_x, y, _width, height) => {
            const visibleTop = insets.top + 12;
            const visibleBottom = windowDimensions.height - effectiveKeyboardInset - extraScrollPadding;
            const inputBottom = y + height;

            if (inputBottom > visibleBottom) {
              const delta = inputBottom - visibleBottom;
              scroll.scrollTo({ y: Math.max(0, scrollOffsetYRef.current + delta), animated: true });
              return;
            }

            if (y < visibleTop) {
              const delta = visibleTop - y;
              scroll.scrollTo({ y: Math.max(0, scrollOffsetYRef.current - delta), animated: true });
            }
          });
        });
      });
    },
    [autoScrollToFocusedInput, effectiveKeyboardInset, extraScrollPadding, insets.top, windowDimensions.height],
  );

  useEffect(() => {
    if (!keyboard.isVisible) {
      return;
    }

    const timer = setTimeout(() => {
      ensureFocusedInputVisible();
    }, keyboard.animationDuration);

    return () => clearTimeout(timer);
  }, [ensureFocusedInputVisible, keyboard.animationDuration, keyboard.isVisible, keyboard.height]);

  const contextValue = useMemo<KeyboardAwareContextValue>(
    () => ({
      notifyInputFocused: (input: TextInput | null) => {
        focusedInputRef.current = input;
        ensureFocusedInputVisible(input);
      },
    }),
    [ensureFocusedInputVisible],
  );

  const resolvedContentContainerStyle = useMemo(() => {
    const flattened = StyleSheet.flatten(contentContainerStyle) ?? {};
    const basePaddingBottom = typeof flattened.paddingBottom === "number" ? flattened.paddingBottom : 0;

    return [
      flattened,
      {
        paddingBottom: basePaddingBottom + effectiveKeyboardInset + insets.bottom + extraBottomPadding,
      },
    ];
  }, [contentContainerStyle, effectiveKeyboardInset, extraBottomPadding, insets.bottom]);

  return (
    <KeyboardAwareContext.Provider value={contextValue}>
      <KeyboardAvoidingView
        style={[styles.keyboardWrap, containerStyle]}
        behavior={behavior}
        keyboardVerticalOffset={Platform.OS === "ios" ? keyboardVerticalOffset : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={resolvedContentContainerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardAwareContext.Provider>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: { flex: 1 },
});
