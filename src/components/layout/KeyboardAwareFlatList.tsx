import { useCallback, useEffect, useMemo, useRef, type ReactElement } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardMetrics } from "@/hooks/useKeyboardMetrics";
import { KeyboardAwareContext, type KeyboardAwareContextValue } from "@/components/layout/KeyboardAwareContext";

interface KeyboardAwareFlatListProps<ItemT> extends FlatListProps<ItemT> {
  extraBottomPadding?: number;
  extraScrollPadding?: number;
  androidKeyboardHandling?: "auto" | "resize" | "pan";
  autoScrollToFocusedInput?: boolean;
}

export function KeyboardAwareFlatList<ItemT>({
  contentContainerStyle,
  keyboardDismissMode,
  keyboardShouldPersistTaps = "handled",
  onScroll,
  scrollEventThrottle = 16,
  extraBottomPadding = 20,
  extraScrollPadding = 20,
  androidKeyboardHandling = "auto",
  autoScrollToFocusedInput = true,
  ...rest
}: KeyboardAwareFlatListProps<ItemT>): ReactElement {
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const keyboard = useKeyboardMetrics();
  const listRef = useRef<FlatList<ItemT>>(null);
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

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [onScroll],
  );

  const ensureFocusedInputVisible = useCallback(
    (targetInput?: TextInput | null) => {
      if (!autoScrollToFocusedInput) {
        return;
      }

      const input = targetInput ?? focusedInputRef.current;
      const list = listRef.current;
      if (!input || !list) {
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
              list.scrollToOffset({ offset: Math.max(0, scrollOffsetYRef.current + delta), animated: true });
              return;
            }

            if (y < visibleTop) {
              const delta = visibleTop - y;
              list.scrollToOffset({ offset: Math.max(0, scrollOffsetYRef.current - delta), animated: true });
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
      notifyInputFocused: (input) => {
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
      <FlatList
        ref={listRef}
        contentContainerStyle={resolvedContentContainerStyle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
        {...rest}
      />
    </KeyboardAwareContext.Provider>
  );
}