import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AppCard } from "@/components/ui/AppCard";

export default function LoginScreen() {
  const { theme, statusBarStyle } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.hero,
            {
              borderRadius: theme.roundness + 8,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.textPrimary,
            },
          ]}
        >
          <Text style={styles.eyebrow}>Smart local exchange</Text>
          <Text style={styles.headline}>A cleaner way to trade nearby.</Text>
          <Text style={styles.subline}>
            Fast listing discovery, transparent negotiation, and secure exchange workflows.
          </Text>
        </View>

        <AppCard
          title="Welcome back"
          subtitle="Continue with OTP to access your listings, requests, and active negotiations."
        >
          <OtpLoginForm />
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f1e8" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 16 },
  hero: {
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#cbd5e1",
    fontWeight: "700",
  },
  headline: { fontSize: 30, fontWeight: "800", color: "#f8fafc", lineHeight: 36 },
  subline: { fontSize: 14, color: "#d1d5db", lineHeight: 21 },
});
