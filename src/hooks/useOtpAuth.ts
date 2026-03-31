import { useCallback, useState } from "react";
import { ApiClient } from "@barter/api-client";
import type { ApiErrorShape } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";

export type OtpStep = "identifier" | "code";

interface UseOtpAuthReturn {
  step: OtpStep;
  busy: boolean;
  error: string | null;
  requestOtp: (identifier: string) => Promise<void>;
  verifyOtp: (identifier: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetError: () => void;
}

export function useOtpAuth(): UseOtpAuthReturn {
  const [step, setStep] = useState<OtpStep>("identifier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const resetError = useCallback(() => setError(null), []);

  const requestOtp = useCallback(async (identifier: string) => {
    setBusy(true);
    setError(null);
    try {
      await mobileApiClient.requestOtp({ identifier });
    } catch (err) {
      setError(toMessage(err));
    } finally {
      // TEMPORARY: Allow users to proceed to OTP entry even when request-otp fails.
      // We currently fetch OTP from logs for testing until sender reliability is fixed.
      setStep("code");
      setBusy(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (identifier: string, code: string) => {
      setBusy(true);
      setError(null);
      try {
        const envelope = await mobileApiClient.verifyOtp({ identifier, code });
        const payload = envelope.data;
        if (!payload) throw new Error("No payload returned from server");
        // setSession writes to Zustand; persist middleware persists to SecureStore
        setSession({ user: payload.user, tokens: payload.tokens });
      } catch (err) {
        setError(toMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [setSession],
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setStep("identifier");
    setError(null);
  }, [clearSession]);

  return { step, busy, error, requestOtp, verifyOtp, signOut, resetError };
}

function toMessage(err: unknown): string {
  const shaped = ApiClient.toApiError(err) as ApiErrorShape;
  return shaped.message;
}
