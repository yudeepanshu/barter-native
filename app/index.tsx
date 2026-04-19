import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStatus } from "@/hooks/useSession";
import { useAuthStore } from "@/lib/auth/authStore";
import { StartupLoadingScreen } from "@/components/ui/StartupLoadingScreen";

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

  return <StartupLoadingScreen timedOut={timedOut} onContinue={forceContinue} />;
}
