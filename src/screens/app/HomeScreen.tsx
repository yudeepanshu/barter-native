import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuthStatus, useSession } from "@/hooks/useSession";
import { ProductFeed } from "@/components/products/ProductFeed";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AppCard } from "@/components/ui/AppCard";
import { ProductListLoadingState } from "@/components/products/ProductListStates";
import { ScreenSafeView } from "@/components/layout/ScreenSafeView";

export default function HomeScreen() {
  const status = useAuthStatus();
  const session = useSession();
  const { theme, statusBarStyle } = useAppTheme();
  // Auto location bootstrap is temporarily disabled.

  if (status === "loading") {
    return (
      <ScreenSafeView>
        <StatusBar style={statusBarStyle} />
        <View style={styles.bootstrapWrap}>
          <AppCard>
            <View style={styles.bootstrapHeader}>
              <Text style={[styles.bootstrapTitle, { color: theme.colors.textPrimary }]}>Loading your feed...</Text>
              <Text style={[styles.bootstrapSubtitle, { color: theme.colors.textMuted }]}>Preparing listings and filters.</Text>
            </View>
          </AppCard>
          <View style={styles.bootstrapListArea}>
            <ProductListLoadingState spinnerSize={28} />
          </View>
        </View>
      </ScreenSafeView>
    );
  }

  if (!session) {
    return <ScreenSafeView />;
  }

  return (
    <ScreenSafeView>
      <StatusBar style={statusBarStyle} />
      <ProductFeed
        userId={session.user.id}
        userName={session.user.userName}
      />
    </ScreenSafeView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  bootstrapWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  bootstrapHeader: {
    gap: 4,
  },
  bootstrapTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  bootstrapSubtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  bootstrapListArea: {
    flex: 1,
    justifyContent: "center",
  },
});
