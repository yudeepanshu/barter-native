import { type ReactNode, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Font from "expo-font";
import { Feather, Ionicons } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiClient } from "@barter/api-client";
import { mobileApiClient } from "@/lib/api/client";
import { queryClient } from "@/lib/query/queryClient";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAuthStore } from "@/lib/auth/authStore";
import {
  readStartupCategoriesSnapshot,
  readStartupFeedSnapshot,
  readStartupSentRequestsSnapshot,
} from "@/lib/feed/feedSnapshotCache";
import {
  getStartupFeedFilters,
  prefetchStartupAuxData,
  prefetchStartupFeed,
  STARTUP_FEED_LIMIT,
  STARTUP_SENT_REQUESTS_LIMIT,
} from "@/lib/feed/startupFeed";
import { getExpoPushTokenForDevice } from "@/lib/notifications/pushRegistration";
import { useRealtimeConnection } from "@/lib/realtime/useRealtimeConnection";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { TopToastHost } from "@/components/ui/TopToastHost";
import { AppDialogProvider } from "@/providers/AppDialogProvider";
import { AppUpdateProvider } from "@/providers/AppUpdateProvider";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;
const AUTH_BOOTSTRAP_GUARD_MS = 7000;
const AUTH_BOOTSTRAP_FEED_WARMUP_TIMEOUT_MS = 2500;

function isAuthBootstrapFailure(error: unknown) {
  const apiError = ApiClient.toApiError(error);
  return apiError.statusCode === 401 || apiError.statusCode === 403;
}

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
      // Rehydrate is isolated so a storage failure doesn't silently skip
      // session validation or mix error messages.
      try {
        await useAuthStore.persist.rehydrate();
      } catch (error) {
        // Treat a failed rehydration as an empty store rather than a hard
        // error — the user will be shown the login screen and can sign in
        // again.  Log as warn (not error) so Metro HMR doesn't show a red
        // box for an expected recovery path.
        logAuthBootstrap("warn", "rehydration failed, treating as unauthenticated", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        if (!cancelled) {
          useAuthStore.getState().clearSession();
        }
        completeBootstrap();
        return;
      }

      if (cancelled) {
        return;
      }

      try {
        const state = useAuthStore.getState();

        if (!state.session) {
          logAuthBootstrap("info", "no persisted session found");
          useAuthStore.setState({ status: "unauthenticated" });
          completeBootstrap();
          return;
        }

        // Restore lightweight cached snapshots immediately so key tabs can render
        // listings while network prefetch runs in the background.
        const userId = state.session.user.id;

        const [cachedFeedItems, cachedCategories, cachedSentRequests] = await Promise.all([
          readStartupFeedSnapshot(userId),
          readStartupCategoriesSnapshot(userId),
          readStartupSentRequestsSnapshot(userId),
        ]);

        if (cachedFeedItems?.length) {
          const listedCachedFeedItems = cachedFeedItems.filter((item) => item.isListed);
          if(listedCachedFeedItems.length) {
            useAppDataStore.getState().upsertProducts(listedCachedFeedItems);
            queryClient.setQueryData(queryKeys.products.infinite(getStartupFeedFilters(userId)), {
              pages: [
                {
                  items: listedCachedFeedItems,
                  nextCursor: null,
                  hasMore: listedCachedFeedItems.length >= STARTUP_FEED_LIMIT,
                },
              ],
              pageParams: [null],
            });
            logAuthBootstrap("info", "startup feed snapshot restored", {
              itemCount: listedCachedFeedItems.length,
            });
          }
        }

        if (cachedCategories?.length) {
          useAppDataStore.getState().upsertCategories(cachedCategories);
          queryClient.setQueryData(queryKeys.categories.all, cachedCategories);
        }

        if (cachedSentRequests?.length) {
          useAppDataStore.getState().upsertRequests(cachedSentRequests);
          queryClient.setQueryData(
            queryKeys.requests.sentInfinite({ limit: STARTUP_SENT_REQUESTS_LIMIT }),
            {
              pages: [
                {
                  items: cachedSentRequests,
                  nextCursor: null,
                  hasMore: cachedSentRequests.length >= STARTUP_SENT_REQUESTS_LIMIT,
                },
              ],
              pageParams: [null],
            },
          );
        }

        const feedWarmupPromise = prefetchStartupFeed(userId);
        void feedWarmupPromise.catch(() => {
          // Best effort warmup.
        });
        void prefetchStartupAuxData();

        if (!cachedFeedItems?.length) {
          try {
            await Promise.race([
              feedWarmupPromise,
              new Promise<never>((_, reject) => {
                setTimeout(
                  () => reject(new Error("Startup feed warmup timeout")),
                  AUTH_BOOTSTRAP_FEED_WARMUP_TIMEOUT_MS,
                );
              }),
            ]);
          } catch {
            // Continue with auth flow; feed will keep warming in background.
          }
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
            queryClient.setQueryData(queryKeys.auth.me, user);
            const latestTokens = useAuthStore.getState().session?.tokens ?? state.session.tokens;
            state.setSession({ user, tokens: latestTokens });
            logAuthBootstrap("info", "session validated");
          }
        } catch (error) {
          const authFailure = isAuthBootstrapFailure(error);

          logAuthBootstrap(
            authFailure ? "warn" : "warn",
            authFailure
              ? "session validation failed after refresh attempt, clearing session"
              : "session validation deferred; preserving persisted session",
            {
              reason: error instanceof Error ? error.message : "unknown",
            },
          );

          if (!cancelled) {
            if (authFailure) {
              state.clearSession();
            } else {
              const latestSession = useAuthStore.getState().session ?? state.session;
              state.setSession(latestSession);
            }
          }
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

function PushNotificationsBootstrap() {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);
  const lastRegisteredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    let cancelled = false;

    const registerDevice = async () => {
      try {
        const expoPushToken = await getExpoPushTokenForDevice();
        if (!expoPushToken) {
          logAuthBootstrap("warn", "push token unavailable; remote push notifications disabled", {
            platform: Platform.OS,
            userId: session.user.id,
          });
          return;
        }

        if (cancelled) {
          return;
        }

        if (lastRegisteredTokenRef.current === expoPushToken) {
          return;
        }

        await mobileApiClient.registerPushDevice({
          expoPushToken,
          platform: Platform.OS,
        });

        if (!cancelled) {
          lastRegisteredTokenRef.current = expoPushToken;
          logAuthBootstrap("info", "push device registered", {
            platform: Platform.OS,
            tokenSuffix: expoPushToken.slice(-8),
          });
        }
      } catch (error) {
        logAuthBootstrap("warn", "push registration failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
    };

    void registerDevice();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const expoPushToken = lastRegisteredTokenRef.current;
    if (!expoPushToken) {
      return;
    }

    lastRegisteredTokenRef.current = null;
    void mobileApiClient.unregisterPushDevice({ expoPushToken }).catch(() => {
      // Best effort cleanup on sign-out.
    });
  }, [status]);

  return null;
}

function RealtimeBootstrap() {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);
  const setProfile = useAppDataStore((state) => state.setProfile);

  useRealtimeConnection();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setProfile(session.user);
      return;
    }

    if (status === "unauthenticated") {
      setProfile(null);
    }
  }, [status, session?.user, setProfile]);

  return null;
}


function IconFontsWarmup() {
  useEffect(() => {
    void Font.loadAsync({
      ...Ionicons.font,
      ...Feather.font,
    }).catch(() => {
      // Best effort warmup; icon components can still lazy-load fonts on demand.
    });
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <AppDialogProvider>
          <AppUpdateProvider />
          <IconFontsWarmup />
          <RealtimeBootstrap />
          <PushNotificationsBootstrap />
          <TopToastHost />
          {children}
        </AppDialogProvider>
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
