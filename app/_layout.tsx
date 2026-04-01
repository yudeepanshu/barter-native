import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { Providers } from "@/providers/Providers";
import { useAuthStatus } from "@/hooks/useSession";
import { useAuthStore } from "@/lib/auth/authStore";

const ROUTE_GUARD_LOADING_TIMEOUT_MS = 10000;

function RouteGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    const timeout = setTimeout(() => {
      if (useAuthStore.getState().status === "loading") {
        // Fail-safe: never let users get stranded on the startup spinner.
        useAuthStore.getState().clearSession();
        router.replace("/(auth)/login");
      }
    }, ROUTE_GUARD_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [status, router]);

  useEffect(() => {
    if (status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)";

    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (status === "authenticated" && !inAppGroup) {
      router.replace("/(app)/(tabs)/home");
    }
  }, [status, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <Providers>
      <RouteGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </RouteGuard>
    </Providers>
  );
}
