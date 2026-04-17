import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { ApiClient } from "@barter/api-client";
import { mobileApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";
import { needsProfileCompletion } from "@/lib/auth/profileCompletion";
import { sanitizeIdentifierInput, sanitizeOtpInput } from "@/lib/utils/inputSanitizer";

const OTP_GENERIC_ERROR_MESSAGE = "Unable to verify OTP right now. Please try again.";
const OTP_INVALID_ERROR_MESSAGE = "Invalid OTP. Please try again.";

export type OtpStep = "identifier" | "sent" | "code";

interface UseOtpAuthReturn {
  step: OtpStep;
  busy: boolean;
  error: string | null;
  requestOtp: (identifier: string) => Promise<void>;
  proceedToCode: () => void;
  verifyOtp: (identifier: string, code: string) => Promise<boolean>;
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

  const resetError = useCallback(() => setError(null), []);

  const requestOtp = useCallback(async (identifier: string) => {
    setBusy(true);
    setError(null);
    try {
      const sanitizedIdentifier = sanitizeIdentifierInput(identifier);
      await mobileApiClient.requestOtp({ identifier: sanitizedIdentifier });
    } catch {
      setError(OTP_GENERIC_ERROR_MESSAGE);
    } finally {
      // TEMPORARY: Allow users to proceed to OTP entry even when request-otp fails.
      // We currently fetch OTP from logs for testing until sender reliability is fixed.
      setStep("sent");
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
        const sanitizedIdentifier = sanitizeIdentifierInput(identifier);
        const sanitizedCode = sanitizeOtpInput(code);
        const envelope = await mobileApiClient.verifyOtp({ identifier: sanitizedIdentifier, code: sanitizedCode });
        const payload = envelope.data;
        if (!payload) throw new Error("No payload returned from server");
        // setSession writes to Zustand; persist middleware persists to SecureStore
        setSession({ user: payload.user, tokens: payload.tokens });

        if (needsProfileCompletion(payload.user.userName)) {
          router.replace("/(app)/complete-profile");
        }

        return true;
      } catch (err) {
        setError(getSafeOtpErrorMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [router, setSession],
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

    await clearSession();
    setStep("identifier");
    setError(null);
  }, [clearSession, session?.tokens.refreshToken]);

  const goToIdentifierStep = useCallback(() => {
    setStep("identifier");
    setError(null);
  }, []);

  return { step, busy, error, requestOtp, proceedToCode, verifyOtp, signOut, goToIdentifierStep, resetError };
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
