import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function LoginScreen() {
  const { theme, statusBarStyle } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={12}
        androidKeyboardHandling="pan"
        extraBottomPadding={28}
        extraScrollPadding={30}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scroll}
      >
        <View
          style={[
            styles.formShell,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.roundness + 10,
            },
          ]}
        >
          <OtpLoginForm />
        </View>

        <Text style={[styles.footerCopy, { color: theme.colors.textMuted }]}>Secure sign-in for listings, requests, and exchange verification.</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardWrap: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 18,
  },
  formShell: {
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 34,
  },
  footerCopy: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
