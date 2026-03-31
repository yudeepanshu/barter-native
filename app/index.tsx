import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuthStatus } from "@/hooks/useSession";
import { useAuthStore } from "@/lib/auth/authStore";

const INDEX_LOADING_TIMEOUT_MS = 10000;

export default function Index() {
  const status = useAuthStatus();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "loading") {
      setTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, INDEX_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [status]);

  if (status === "authenticated") {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  const forceContinue = () => {
    useAuthStore.getState().clearSession();
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
      {timedOut ? (
        <>
          <Text style={{ marginTop: 12, color: "#334155" }}>
            Startup is taking longer than expected.
          </Text>
          <Pressable
            onPress={forceContinue}
            style={{
              marginTop: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: "#0f172a",
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "600" }}>Continue to login</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
