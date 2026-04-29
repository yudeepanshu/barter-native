import type { AppUpdateChannel, AppUpdatePlatform, AppVersionPolicyResult } from '@barter/types';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { mobileApiClient } from '@/lib/api/client';

const CHECK_COOLDOWN_MS = 120_000;

function getCurrentVersion() {
  const fromConfig = Constants.expoConfig?.version?.trim();
  if (fromConfig) {
    return fromConfig;
  }

  return '0.0.0';
}

function getUpdateChannel(): AppUpdateChannel {
  const raw = (process.env.EXPO_PUBLIC_APP_UPDATE_CHANNEL ?? '').trim().toLowerCase();
  if (raw === 'alpha' || raw === 'beta' || raw === 'production') {
    return raw;
  }

  return 'alpha';
//   TODO -> return 'production';
}

export function AppUpdateProvider() {
  const { theme } = useAppTheme();
  const appPlatform: AppUpdatePlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  const currentVersion = useMemo(() => getCurrentVersion(), []);
  const appChannel = useMemo(() => getUpdateChannel(), []);

  const [policy, setPolicy] = useState<AppVersionPolicyResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isOpeningPrimary, setIsOpeningPrimary] = useState(false);
  const [isOpeningSecondary, setIsOpeningSecondary] = useState(false);

  const lastCheckAtRef = useRef(0);
  const dismissedLatestKeyRef = useRef<string | null>(null);
  const notifiedVersionRef = useRef<string | null>(null);

  const sendUpdateNotification = useCallback(
    async (policy: AppVersionPolicyResult) => {
      const notificationKey = `${policy.channel}:${policy.latestVersion}`;

      // Only send notification once per unique update version
      if (notifiedVersionRef.current === notificationKey) {
        return;
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: policy.title,
            body: policy.message,
            data: {
              updateType: policy.updateType,
              latestVersion: policy.latestVersion,
              channel: policy.channel,
            },
          },
          trigger: null, // Send immediately
        });

        notifiedVersionRef.current = notificationKey;
      } catch {
        // Best effort: silently ignore notification failures
      }
    },
    [],
  );

  const runPolicyCheck = useCallback(
    async (forceRun = false) => {
      const now = Date.now();
      if (!forceRun && now - lastCheckAtRef.current < CHECK_COOLDOWN_MS) {
        return;
      }

      lastCheckAtRef.current = now;

      try {
        const envelope = await mobileApiClient.getAppVersionPolicy({
          platform: appPlatform,
          channel: appChannel,
          currentVersion,
        });
        const nextPolicy = envelope.data ?? null;

        if (!nextPolicy || nextPolicy.updateType === 'none') {
          setPolicy(null);
          setIsVisible(false);
          return;
        }

        const policyKey = `${nextPolicy.channel}:${nextPolicy.latestVersion}`;
        if (
          nextPolicy.updateType === 'normal' &&
          dismissedLatestKeyRef.current === policyKey
        ) {
          return;
        }

        void sendUpdateNotification(nextPolicy);
        setPolicy(nextPolicy);
        setIsVisible(true);
      } catch {
        // Best effort: silently ignore failures and keep app usable.
      }
    },
    [appChannel, appPlatform, currentVersion, sendUpdateNotification],
  );

  useEffect(() => {
    void runPolicyCheck(true);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runPolicyCheck();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runPolicyCheck]);

  const closeModal = useCallback(() => {
    if (!policy?.dismissible) {
      return;
    }

    dismissedLatestKeyRef.current = `${policy.channel}:${policy.latestVersion}`;
    setIsVisible(false);
  }, [policy]);

  // Determine whether the primary button should be shown based on
  // preferredSource and the presence of the corresponding URL.
  const shouldShowPrimaryButton = useMemo(() => {
    if (!policy) return false;
    if (policy.preferredSource === 'direct-apk') {
      return !!policy.directApkUrl;
    }
    if (policy.preferredSource === 'play-store') {
      return !!policy.primaryUpdateUrl;
    }
    // Fallback: show if any primary URL is present
    return !!policy.primaryUpdateUrl;
  }, [policy]);

  // Secondary button requires both URL and label to be present.
  const shouldShowSecondaryButton = useMemo(() => {
    if (!policy) return false;
    return !!policy.secondaryUpdateUrl && !!policy.secondaryCtaLabel;
  }, [policy]);

  // Resolves the correct URL based on preferredSource and opens it.
  const openUpdateUrl = useCallback(
    async (source: 'primary' | 'secondary') => {
      const url =
        source === 'primary'
          ? policy?.preferredSource === 'direct-apk'
            ? policy?.directApkUrl
            : policy?.primaryUpdateUrl
          : policy?.secondaryUpdateUrl;

      if (!url) return;

      if (source === 'primary') {
        setIsOpeningPrimary(true);
      } else {
        setIsOpeningSecondary(true);
      }

      try {
        // Try direct open first for regular http(s) links to avoid canOpenURL false negatives.
        await Linking.openURL(url);
      } catch {
        try {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          }
        } catch {
          // Best effort: keep app usable even if update URL cannot be opened.
        }
      } finally {
        if (source === 'primary') {
          setIsOpeningPrimary(false);
        } else {
          setIsOpeningSecondary(false);
        }
      }
    },
    [policy],
  );

  if (!policy) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        onPress={closeModal}
      >
        <Pressable
          style={[
            styles.card,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
          onPress={() => {
            // Keep modal open when tapping inside.
          }}
        >
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{policy.title}</Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{policy.message}</Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>Current {policy.currentVersion} • Latest {policy.latestVersion}</Text>

          <View style={styles.actionsWrap}>
            {policy.dismissible ? (
              <Pressable
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                ]}
                onPress={closeModal}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.textPrimary }]}>Later</Text>
              </Pressable>
            ) : null}

            {/* Primary button: only rendered when source + URL are both valid */}
            {shouldShowPrimaryButton ? (
              <Pressable
                style={[
                  styles.primaryButton,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                disabled={isOpeningPrimary}
                onPress={() => void openUpdateUrl('primary')}
              >
                {isOpeningPrimary ? (
                  <ActivityIndicator size={14} color={theme.colors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.colors.onPrimary }]}>
                    {policy.primaryCtaLabel}
                  </Text>
                )}
              </Pressable>
            ) : null}

            {/* Secondary button: only rendered when both URL and label are present */}
            {shouldShowSecondaryButton ? (
              <Pressable
                style={[
                  styles.tertiaryButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                disabled={isOpeningSecondary}
                onPress={() => void openUpdateUrl('secondary')}
              >
                {isOpeningSecondary ? (
                  <ActivityIndicator size={14} color={theme.colors.textSecondary} />
                ) : (
                  <Text style={[styles.tertiaryButtonText, { color: theme.colors.textSecondary }]}>
                    {policy.secondaryCtaLabel}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  actionsWrap: {
    marginTop: 8,
    gap: 8,
  },
  primaryButton: {
    borderWidth: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tertiaryButton: {
    borderWidth: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tertiaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
