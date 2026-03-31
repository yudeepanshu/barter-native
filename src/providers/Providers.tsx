import { type ReactNode, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryClient } from "@/lib/query/queryClient";
import { useAuthStore } from "@/lib/auth/authStore";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;
const AUTH_BOOTSTRAP_GUARD_MS = 7000;

function logAuthBootstrap(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>,
) {
  if (level === "info" && !__DEV__) {
    return;
  }

  const payload = meta ? { ...meta } : undefined;

  if (level === "warn") {
    console.warn(`[auth-bootstrap] ${message}`, payload ?? "");
    return;
  }

  if (level === "error") {
    console.error(`[auth-bootstrap] ${message}`, payload ?? "");
    return;
  }

  console.info(`[auth-bootstrap] ${message}`, payload ?? "");
}

/**
 * Triggers Zustand persist rehydration from SecureStore and blocks rendering
 * until the restored session is validated against /users/me.
 */
function AuthBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let completed = false;
    let guardTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    logAuthBootstrap("info", "bootstrap started");

    const completeBootstrap = () => {
      if (cancelled || completed) {
        return;
      }

      completed = true;

      if (guardTimer) {
        clearTimeout(guardTimer);
      }

      const currentStatus = useAuthStore.getState().status;

      if (useAuthStore.getState().status === "loading") {
        useAuthStore.setState({ status: "unauthenticated" });
      }

      logAuthBootstrap("info", "bootstrap completed", {
        statusBeforeComplete: currentStatus,
        elapsedMs: Date.now() - startedAt,
      });
    };

    const resolveAuthState = async () => {
      try {
        await useAuthStore.persist.rehydrate();

        if (cancelled) {
          return;
        }

        const state = useAuthStore.getState();

        if (!state.session) {
          logAuthBootstrap("info", "no persisted session found");
          useAuthStore.setState({ status: "unauthenticated" });
          completeBootstrap();
          return;
        }

        try {
          const envelope = await Promise.race([
            mobileApiClient.getCurrentUser(),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error("Auth bootstrap profile request timeout")),
                AUTH_BOOTSTRAP_TIMEOUT_MS,
              );
            }),
          ]);
          const user = envelope.data;

          if (!user) {
            throw new Error("Missing profile payload");
          }

          if (!cancelled) {
            state.setSession({ user, tokens: state.session.tokens });
            logAuthBootstrap("info", "session validated");
          }
        } catch (error) {
          logAuthBootstrap("warn", "session validation failed, clearing session", {
            reason: error instanceof Error ? error.message : "unknown",
          });
          if (!cancelled) {
            state.clearSession();
          }
        }
      } catch (error) {
        logAuthBootstrap("error", "rehydration failed, clearing session", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        if (!cancelled) {
          useAuthStore.getState().clearSession();
        }
      } finally {
        completeBootstrap();
      }
    };

    void resolveAuthState();

    // Fallback guard: never allow indefinite loading screen.
    guardTimer = setTimeout(() => {
      logAuthBootstrap("warn", "guard timeout reached, forcing bootstrap completion", {
        statusAtGuard: useAuthStore.getState().status,
        elapsedMs: Date.now() - startedAt,
      });
      completeBootstrap();
    }, AUTH_BOOTSTRAP_GUARD_MS);

    return () => {
      cancelled = true;
      if (guardTimer) {
        clearTimeout(guardTimer);
      }
    };
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
