import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuthStatus, useSession } from "@/hooks/useSession";
import { ProductFeed } from "@/components/products/ProductFeed";
import { Spinner } from "@/components/ui/Spinner";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function HomeScreen() {
  const status = useAuthStatus();
  const session = useSession();
  const { theme, statusBarStyle } = useAppTheme();
  // Auto location bootstrap is temporarily disabled.

  if (status === "loading") {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}> 
        <Spinner />
      </SafeAreaView>
    );
  }

  if (!session) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <ProductFeed
        userId={session.user.id}
        userName={session.user.userName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f1e8" },
});
