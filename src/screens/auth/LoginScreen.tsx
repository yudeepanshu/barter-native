import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function LoginScreen() {
  const { theme, statusBarStyle } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          bounces={false}
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
        </ScrollView>
      </KeyboardAvoidingView>
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
