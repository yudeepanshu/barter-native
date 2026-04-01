import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AppCard } from "@/components/ui/AppCard";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";

export default function LoginScreen() {
  const { theme, statusBarStyle } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={16}
        contentContainerStyle={styles.scroll}
      >
        <View
          style={[
            styles.hero,
            {
              borderRadius: theme.roundness + 8,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: theme.colors.onPrimary, opacity: 0.78 }]}>Smart local exchange</Text>
          <Text style={[styles.headline, { color: theme.colors.onPrimary }]}>A cleaner way to trade nearby.</Text>
          <Text style={[styles.subline, { color: theme.colors.onPrimary, opacity: 0.9 }]}>
            Fast listing discovery, transparent negotiation, and secure exchange workflows.
          </Text>
        </View>

        <AppCard
          title="Welcome back"
          subtitle="Continue with OTP to access your listings, requests, and active negotiations."
        >
          <OtpLoginForm />
        </AppCard>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardWrap: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "flex-start", padding: 20, paddingTop: 28, paddingBottom: 28, gap: 16 },
  hero: {
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  headline: { fontSize: 30, fontWeight: "800", lineHeight: 36 },
  subline: { fontSize: 14, lineHeight: 21 },
});
