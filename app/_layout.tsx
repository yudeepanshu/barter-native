import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { Providers } from "@/providers/Providers";
import { useAuthStatus } from "@/hooks/useSession";
import { useAuthStore } from "@/lib/auth/authStore";
import { needsProfileCompletion } from "@/lib/auth/profileCompletion";
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
} from "@/lib/notifications/pushRegistration";

const ROUTE_GUARD_LOADING_TIMEOUT_MS = 10000;

function RouteGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();
  const session = useAuthStore((state) => state.session);
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
    const inCompleteProfile = inAppGroup && segments[1] === "complete-profile";
    const mustCompleteProfile =
      status === "authenticated" && needsProfileCompletion(session?.user.userName);

    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (mustCompleteProfile && !inCompleteProfile) {
      router.replace("/(app)/complete-profile");
      return;
    }

    if (status === "authenticated" && !mustCompleteProfile && inCompleteProfile) {
      router.replace("/(app)/(tabs)/home");
      return;
    }

    if (status === "authenticated" && !inAppGroup) {
      router.replace("/(app)/(tabs)/home");
    }
  }, [status, session?.user.userName, segments, router]);

  return <>{children}</>;
}

function NotificationNavigationBootstrap() {
  const status = useAuthStatus();
  const router = useRouter();
  const lastHandledResponseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const handleResponse = (response: {
      notification?: {
        request?: {
          identifier?: string;
          content?: { data?: Record<string, unknown> };
        };
      };
    }) => {
      const responseId = response.notification?.request?.identifier ?? null;
      if (responseId && lastHandledResponseIdRef.current === responseId) {
        return;
      }

      if (responseId) {
        lastHandledResponseIdRef.current = responseId;
      }

      const payload = response.notification?.request?.content?.data ?? {};
      const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
      const productId = typeof payload.productId === "string" ? payload.productId : null;

      if (requestId) {
        router.push(`/(app)/requests/${requestId}`);
        return;
      }

      if (productId) {
        router.push(`/(app)/products/${productId}`);
      }
    };

    const setup = async () => {
      const lastResponse = await getLastNotificationResponse();
      if (!cancelled && lastResponse) {
        handleResponse(lastResponse);
      }

      unsubscribe = await addNotificationResponseReceivedListener(handleResponse);
    };

    void setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router, status]);

  return null;
}

export default function RootLayout() {
  return (
    <Providers>
      <NotificationNavigationBootstrap />
      <RouteGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </RouteGuard>
    </Providers>
  );
}
