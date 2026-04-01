import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface KeyboardAwareScrollViewProps extends PropsWithChildren {
  containerStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  keyboardVerticalOffset?: number;
  keyboardDismissMode?: ScrollViewProps["keyboardDismissMode"];
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  refreshControl?: ScrollViewProps["refreshControl"];
}

export function KeyboardAwareScrollView({
  children,
  containerStyle,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  keyboardDismissMode,
  keyboardShouldPersistTaps = "handled",
  refreshControl,
}: KeyboardAwareScrollViewProps) {
  const behavior: KeyboardAvoidingViewProps["behavior"] = Platform.OS === "ios" ? "padding" : "height";

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardWrap, containerStyle]}
      behavior={behavior}
      keyboardVerticalOffset={Platform.OS === "ios" ? keyboardVerticalOffset : 0}
    >
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: { flex: 1 },
});
