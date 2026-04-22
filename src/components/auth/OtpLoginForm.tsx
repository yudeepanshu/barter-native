import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useOtpAuth } from "@/hooks/useOtpAuth";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { useAppTheme } from "@/hooks/useAppTheme";
import { OtpCodeField } from "@/components/auth/OtpCodeField";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useTopToastStore } from "@/lib/ui/topToastStore";
import {
  isValidEmailIdentifier,
  sanitizeEmailIdentifierInput,
  sanitizeOtpInput,
} from "@/lib/utils/inputSanitizer";

function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const [local, domain] = trimmed.split("@");
    const visible = local.slice(0, 2);
    const masked = "*".repeat(Math.max(local.length - 2, 2));
    return `${visible}${masked}@${domain}`;
  }
  if (trimmed.length >= 6) {
    return trimmed.slice(0, 2) + "*".repeat(trimmed.length - 4) + trimmed.slice(-2);
  }
  return trimmed;
}

function OtpIllustration() {
  const { theme } = useAppTheme();

  return (
    <View style={styles.illustrationWrap}>
      <View style={[styles.illustrationRing, { borderColor: `${theme.colors.primary}33` }]} />
      <View style={[styles.illustrationRingLarge, { borderColor: `${theme.colors.primary}22` }]} />
      <View
        style={[
          styles.brandIconShell,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        <Image
          source={require("../../../assets/icon.png")}
          style={styles.brandIconImage}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

export function OtpLoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [otpRejected, setOtpRejected] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const lastSubmittedCodeRef = useRef<string | null>(null);
  const verifyRequestIdRef = useRef(0);
  const {
    step,
    busy,
    error,
    requestOtp,
    proceedToCode,
    verifyOtp,
    loginWithGoogleIdToken,
    goToIdentifierStep,
    resetError,
  } = useOtpAuth();
  const { googleEnabled, googleLoading, googleError, startGoogleLogin, resetGoogleError } =
    useGoogleAuth(loginWithGoogleIdToken);
  const enqueueToast = useTopToastStore((state) => state.enqueueToast);
  const { theme } = useAppTheme();
  const isOtpStep = step === "sent" || step === "code";
  const emailValue = sanitizeEmailIdentifierInput(identifier);
  const canRequestOtp = isValidEmailIdentifier(emailValue);
  const otpBusy = busy && !googleLoading;
  const headerTitle = step === "identifier" ? "Welcome to Flippe" : "Check your email";
  const headerSubtitle =
    step === "identifier"
      ? "Sign in to list products, manage requests, and complete secure exchanges."
      : "You are one step away from getting back into your account.";

  useEffect(() => {
    if (step === "sent" && code.trim().length > 0) {
      proceedToCode();
    }
  }, [code, proceedToCode, step]);

  useEffect(() => {
    const sanitizedIdentifier = sanitizeEmailIdentifierInput(identifier);
    const sanitizedCode = sanitizeOtpInput(code);

    if (!isOtpStep || sanitizedCode.length !== 6 || sanitizedIdentifier.length === 0) {
      return;
    }

    if (busy || autoVerifying) {
      return;
    }

    if (lastSubmittedCodeRef.current === sanitizedCode) {
      return;
    }

    lastSubmittedCodeRef.current = sanitizedCode;
    const requestId = ++verifyRequestIdRef.current;
    setAutoVerifying(true);

    void (async () => {
      const ok = await verifyOtp(sanitizedIdentifier, sanitizedCode);

      if (verifyRequestIdRef.current !== requestId) {
        return;
      }

      if (!ok) {
        setOtpRejected(true);
      }

      setAutoVerifying(false);
    })();
  }, [autoVerifying, busy, code, identifier, isOtpStep, verifyOtp]);

  useEffect(() => {
    if (!googleError) {
      return;
    }

    enqueueToast({
      title: "Login failed",
      message: "Google sign-in could not be completed. Please try again in a moment.",
      variant: "error",
      durationMs: 3200,
    });
  }, [enqueueToast, googleError]);

  return (
    <View style={styles.container}>
      {googleLoading ? (
        <View
          pointerEvents="none"
          style={[
            styles.topAuthLoader,
            {
              backgroundColor: theme.mode === "dark" ? "#12253b" : "#eff6ff",
              borderColor: theme.mode === "dark" ? "#1d4f8c" : "#93c5fd",
            },
          ]}
        >
          <Spinner size={15} />
          <Text
            style={[
              styles.topAuthLoaderText,
              { color: theme.mode === "dark" ? "#dbeafe" : "#1e3a8a" },
            ]}
          >
            Signing in with Google...
          </Text>
        </View>
      ) : null}
      <OtpIllustration />
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{headerTitle}</Text>
      <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>{headerSubtitle}</Text>

      {step === "identifier" && (
        <>
          <View style={styles.entryBlock}>
            <Input
              value={identifier}
              onChangeText={(val) => {
                setIdentifier(sanitizeEmailIdentifierInput(val));
                resetError();
                resetGoogleError();
              }}
              label=""
              placeholder="Email address"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
              error={otpBusy || !error ? null : error}
              style={styles.identifierInput}
            />
          </View>
          <Button
            label="Get OTP"
            onPress={() => requestOtp(emailValue)}
              loading={otpBusy}
              disabled={!canRequestOtp || otpBusy || googleLoading}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary, borderRadius: 999 }]}
            labelStyle={styles.primaryButtonLabel}
          />

          {googleEnabled ? (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              </View>

              <Button
                label="Continue with Google"
                onPress={() => {
                  resetError();
                  void startGoogleLogin();
                }}
                loading={googleLoading}
                disabled={busy}
                variant="ghost"
                leftIcon={<Image source={require("../../../assets/google-logo.png")} style={styles.googleLogoIcon} />}
                style={[styles.googleButton, { borderRadius: 999 }]}
              />
            </>
          ) : null}
        </>
      )}

      {isOtpStep && (
        <>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Enter the 6-digit code sent to <Text style={[styles.identifierHighlight, { color: theme.colors.textPrimary }]}>{maskIdentifier(identifier)}</Text></Text>
          <Pressable
            onPress={() => {
              setCode("");
              setOtpRejected(false);
              setAutoVerifying(false);
              lastSubmittedCodeRef.current = null;
              verifyRequestIdRef.current += 1;
              resetError();
              goToIdentifierStep();
            }}
            disabled={busy}
            style={({ pressed }) => [styles.notYouWrap, { opacity: pressed || busy ? 0.7 : 1 }]}
          >
            <Text style={[styles.notYouText, { color: "#00BFFF" }]}>Not you?</Text>
          </Pressable>

          <OtpCodeField
            value={code}
            onChangeText={(val) => {
              const next = sanitizeOtpInput(val);
              setCode(next);
              if (otpRejected) {
                setOtpRejected(false);
              }
              if (next.length < 6) {
                lastSubmittedCodeRef.current = null;
                verifyRequestIdRef.current += 1;
                setAutoVerifying(false);
              }
              resetError();
            }}
            editable={!busy && !autoVerifying}
            active={!busy && !autoVerifying}
            autoFocus={isOtpStep}
            invalid={otpRejected}
          />

          {error ? <Text style={[styles.inlineError, { color: theme.colors.danger }]}>{error}</Text> : null}

          <View style={styles.resendRow}>
            <Text style={[styles.resendPrompt, { color: theme.colors.textMuted }]}>Didn't you receive the OTP? </Text>
            <Pressable
              onPress={() => requestOtp(emailValue)}
              disabled={busy}
              style={({ pressed }) => [{ opacity: pressed || busy ? 0.7 : 1 }]}
            >
              <Text style={[styles.resendLink, { color: "#00BFFF" }]}>Resend OTP</Text>
            </Pressable>
          </View>

          {autoVerifying && !otpRejected && !error ? (
            <View style={styles.autoVerifyRow}>
              <Spinner size={16} />
              <Text style={[styles.autoVerifyText, { color: theme.colors.textMuted }]}>Verifying OTP...</Text>
            </View>
          ) : (
            <Text style={[styles.autoVerifyHint, { color: theme.colors.textMuted }]}>OTP is verified automatically once all 6 digits are entered.</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 18,
    width: "100%",
    position: "relative",
  },
  topAuthLoader: {
    position: "absolute",
    top: -18,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  topAuthLoaderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  illustrationWrap: {
    width: 196,
    height: 196,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  illustrationRing: {
    position: "absolute",
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  illustrationRingLarge: {
    position: "absolute",
    width: 178,
    height: 178,
    borderRadius: 89,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  brandIconShell: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandIconImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 330,
    marginTop: -6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },
  entryBlock: {
    width: "100%",
    marginTop: 14,
    gap: 0,
  },
  identifierInput: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "left",
    paddingHorizontal: 14,
  },
  identifierHighlight: {
    fontWeight: "800",
  },
  notYouWrap: {
    marginTop: -8,
  },
  notYouText: {
    fontSize: 14,
    fontWeight: "700",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: -2,
  },
  resendPrompt: {
    fontSize: 13,
    lineHeight: 18,
  },
  resendLink: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  autoVerifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  autoVerifyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  autoVerifyHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
  inlineError: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: -4,
  },
  primaryButton: {
    minHeight: 54,
    width: "100%",
    marginTop: 8,
  },
  googleButton: {
    minHeight: 50,
    width: "100%",
    marginTop: 4,
  },
  googleLogoIcon: {
    width: 18,
    height: 18,
  },
  dividerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
});
