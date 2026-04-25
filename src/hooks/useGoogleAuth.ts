import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Alert } from "react-native";

const GOOGLE_GENERIC_ERROR_MESSAGE = "Unable to continue with Google. Please try again.";

export interface UseGoogleAuthResult {
  googleEnabled: boolean;
  googleLoading: boolean;
  googleError: string | null;
  startGoogleLogin: () => Promise<void>;
  resetGoogleError: () => void;
}

export function useGoogleAuth(
  loginWithGoogleIdToken: (idToken: string) => Promise<boolean>,
): UseGoogleAuthResult {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const config = useMemo(
    () => ({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    }),
    [],
  );

  const googleEnabled = process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
  const hasWebClientId = Boolean(config.webClientId);

  useEffect(() => {
    GoogleSignin.configure({
      scopes: ["openid", "profile", "email"],
      webClientId: config.webClientId,
      offlineAccess: false,
    });
  }, [config.webClientId]);

  const startGoogleLogin = useCallback(async () => {
    setGoogleError(null);

    if (!googleEnabled) {
      setGoogleError("Google sign-in is currently disabled.");
      return;
    }

    if (!hasWebClientId) {
      setGoogleError("Google sign-in is not configured for this app build.");
      return;
    }

    setGoogleLoading(true);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result: any = await GoogleSignin.signIn();
      const idToken = result?.data?.idToken ?? result?.idToken;

      if (!idToken) {
        setGoogleError("Google id token is missing. Check web client id configuration.");
        setGoogleLoading(false);
        return;
      }

      const ok = await loginWithGoogleIdToken(idToken);

      if (!ok) {
        setGoogleError(GOOGLE_GENERIC_ERROR_MESSAGE);
      }
    } catch (error: any) {
      Alert.alert('Auth Error', `Code: ${error?.code}\nMessage: ${error?.message}`);
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        setGoogleError(null);
      } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setGoogleError("Google Play Services are not available on this device.");
      } else {
        setGoogleError("Google sign-in failed. Please try again.");
      }
      setGoogleLoading(false);
      return;
    }

    setGoogleLoading(false);
  }, [googleEnabled, hasWebClientId, loginWithGoogleIdToken]);

  const resetGoogleError = useCallback(() => setGoogleError(null), []);

  return { googleEnabled, googleLoading, googleError, startGoogleLogin, resetGoogleError };
}
