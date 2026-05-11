import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import type { VerifyOtpResult } from "@barter/types";
import { ApiClient } from "@barter/api-client";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { mobileApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";
import { needsProfileCompletion } from "@/lib/auth/profileCompletion";
import { sanitizeEmailIdentifierInput, sanitizeOtpInput } from "@/lib/utils/inputSanitizer";
import { queryClient } from "@/lib/query/queryClient";
import { queryKeys } from "@/lib/query/queryKeys";

const OTP_GENERIC_ERROR_MESSAGE = "Unable to verify OTP right now. Please try again.";
const OTP_INVALID_ERROR_MESSAGE = "Invalid OTP. Please try again.";
const OTP_SEND_ERROR_MESSAGE = "Unable to send OTP right now. Please try again.";

export type OtpStep = "identifier" | "sent" | "code";

interface UseOtpAuthReturn {
  step: OtpStep;
  busy: boolean;
  error: string | null;
  requestOtp: (identifier: string) => Promise<void>;
  proceedToCode: () => void;
  verifyOtp: (identifier: string, code: string) => Promise<boolean>;
  loginWithGoogleIdToken: (idToken: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  goToIdentifierStep: () => void;
  resetError: () => void;
}

export function useOtpAuth(): UseOtpAuthReturn {
  const [step, setStep] = useState<OtpStep>("identifier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const session = useAuthStore((s) => s.session);

  const completeAuthenticatedSession = useCallback(
    (payload: VerifyOtpResult) => {
      setSession({ user: payload.user, tokens: payload.tokens });

      if (needsProfileCompletion(payload.user.userName)) {
        router.replace("/(app)/complete-profile");
      }
    },
    [router, setSession],
  );

  const resetError = useCallback(() => setError(null), []);

  const requestOtp = useCallback(async (identifier: string) => {
    setBusy(true);
    setError(null);
    try {
      const sanitizedIdentifier = sanitizeEmailIdentifierInput(identifier);
      await mobileApiClient.requestOtp({ identifier: sanitizedIdentifier });
      setStep("sent");
    } catch {
      setError(OTP_SEND_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }, []);

  const proceedToCode = useCallback(() => {
    setStep("code");
    setError(null);
  }, []);

  const verifyOtp = useCallback(
    async (identifier: string, code: string) => {
      setBusy(true);
      setError(null);
      try {
        const sanitizedIdentifier = sanitizeEmailIdentifierInput(identifier);
        const sanitizedCode = sanitizeOtpInput(code);
        const envelope = await mobileApiClient.verifyOtp({ identifier: sanitizedIdentifier, code: sanitizedCode });
        const payload = envelope.data;
        if (!payload) throw new Error("No payload returned from server");
        completeAuthenticatedSession(payload);

        return true;
      } catch (err) {
        setError(getSafeOtpErrorMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [completeAuthenticatedSession],
  );

  const loginWithGoogleIdToken = useCallback(
    async (idToken: string) => {
      setBusy(true);
      setError(null);

      try {
        const envelope = await mobileApiClient.loginWithGoogle({ idToken: idToken.trim() });
        const payload = envelope.data;

        if (!payload) {
          throw new Error("No payload returned from server");
        }

        completeAuthenticatedSession(payload);
        return true;
      } catch {
        return false;
      } finally {
        setBusy(false);
      }
    },
    [completeAuthenticatedSession],
  );

  const signOut = useCallback(async () => {
    try {
      const refreshToken = session?.tokens.refreshToken;
      if (refreshToken) {
        await mobileApiClient.logout({ refreshToken });
      }
    } catch {
      // Best-effort logout call: even if network fails, clear local session.
    }

    try {
      // Clear Google SDK cached account so next login can re-prompt account chooser.
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // Ignore: user may have no active Google session in SDK cache.
    }

    queryClient.clear();

    await clearSession();
    setStep("identifier");
    setError(null);
  }, [clearSession, session?.tokens.refreshToken]);

  const goToIdentifierStep = useCallback(() => {
    setStep("identifier");
    setError(null);
  }, []);

  return {
    step,
    busy,
    error,
    requestOtp,
    proceedToCode,
    verifyOtp,
    loginWithGoogleIdToken,
    signOut,
    goToIdentifierStep,
    resetError,
  };
}

function getSafeOtpErrorMessage(err: unknown): string {
  const apiError = ApiClient.toApiError(err);

  // Keep user-facing messages intentionally generic and avoid backend text leakage.
  // 400/401 are treated as an invalid OTP attempt in this flow.
  if (apiError.statusCode === 400 || apiError.statusCode === 401) {
    return OTP_INVALID_ERROR_MESSAGE;
  }

  return OTP_GENERIC_ERROR_MESSAGE;
}
