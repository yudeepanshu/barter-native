import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
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
  scrollRef?: any;
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
  scrollRef = null,
}: KeyboardAwareScrollViewProps) {
  const behavior: KeyboardAvoidingViewProps["behavior"] =
    Platform.OS === "ios" ? "padding" : "height";

  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const keyboard = useKeyboardMetrics();

  const innerScrollRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const scrollOffsetYRef = useRef(0);
  const baselineWindowHeightRef = useRef(windowDimensions.height);

  const handleScrollRef = useCallback(
    (node: ScrollView | null) => {
      innerScrollRef.current = node;
      if (scrollRef) {
        scrollRef.current = node;
      }
    },
    [scrollRef],
  );

  useEffect(() => {
    if (!keyboard.isVisible) {
      baselineWindowHeightRef.current = windowDimensions.height;
    }
  }, [keyboard.isVisible, windowDimensions.height]);

  const isAndroidResizeActive = useMemo(() => {
    if (Platform.OS !== "android") return false;
    if (androidKeyboardHandling === "resize") return true;
    if (androidKeyboardHandling === "pan") return false;
    return baselineWindowHeightRef.current - windowDimensions.height > 60;
  }, [androidKeyboardHandling, windowDimensions.height]);

  const effectiveKeyboardInset = useMemo(() => {
    if (!keyboard.isVisible) return 0;

    if (Platform.OS === "android" && isAndroidResizeActive) return 0;

    const safeInset = Platform.OS === "ios" ? insets.bottom : 0;
    return Math.max(0, keyboard.height - safeInset);
  }, [insets.bottom, isAndroidResizeActive, keyboard.height, keyboard.isVisible]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const ensureFocusedInputVisible = useCallback(() => {
    if (!autoScrollToFocusedInput) return;

    const input = focusedInputRef.current;
    const scroll = innerScrollRef.current;

    if (!input || !scroll || !keyboard.isVisible) return;

    input.measureInWindow((_x, y, _width, height) => {
      const visibleTop = insets.top + 12;
      const visibleBottom =
        windowDimensions.height - effectiveKeyboardInset - extraScrollPadding;

      const inputBottom = y + height;

      // ✅ Guard (avoid unnecessary scroll)
      if (inputBottom <= visibleBottom && y >= visibleTop) {
        return;
      }

      if (inputBottom > visibleBottom) {
        const delta = inputBottom - visibleBottom;
        scroll.scrollTo({
          y: Math.max(0, scrollOffsetYRef.current + delta),
          animated: true,
        });
        return;
      }

      if (y < visibleTop) {
        const delta = visibleTop - y;
        scroll.scrollTo({
          y: Math.max(0, scrollOffsetYRef.current - delta),
          animated: true,
        });
      }
    });
  }, [
    autoScrollToFocusedInput,
    effectiveKeyboardInset,
    extraScrollPadding,
    insets.top,
    keyboard.isVisible,
    windowDimensions.height,
  ]);

  // ✅ KEY FIX: trigger after keyboard/layout update
  useEffect(() => {
    if (!keyboard.isVisible) return;

    ensureFocusedInputVisible();
  }, [keyboard.isVisible, effectiveKeyboardInset, ensureFocusedInputVisible]);

  const contextValue = useMemo<KeyboardAwareContextValue>(
    () => ({
      notifyInputFocused: (input: TextInput | null) => {
        focusedInputRef.current = input;
      },
    }),
    [],
  );

  const resolvedContentContainerStyle = useMemo(() => {
    const flattened = StyleSheet.flatten(contentContainerStyle) ?? {};
    const basePaddingBottom =
      typeof flattened.paddingBottom === "number" ? flattened.paddingBottom : 0;

    return [
      flattened,
      {
        paddingBottom:
          basePaddingBottom +
          effectiveKeyboardInset +
          insets.bottom +
          extraBottomPadding,
      },
    ];
  }, [contentContainerStyle, effectiveKeyboardInset, extraBottomPadding, insets.bottom]);

  return (
    <KeyboardAwareContext.Provider value={contextValue}>
      <KeyboardAvoidingView
        style={[styles.keyboardWrap, containerStyle]}
        behavior={behavior}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? keyboardVerticalOffset : 0
        }
      >
        <ScrollView
          ref={handleScrollRef}
          contentContainerStyle={resolvedContentContainerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={
            keyboardDismissMode ??
            (Platform.OS === "ios" ? "interactive" : "on-drag")
          }
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