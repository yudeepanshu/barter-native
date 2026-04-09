import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useOtpAuth } from "@/hooks/useOtpAuth";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/hooks/useAppTheme";
import { OtpCodeField } from "@/components/auth/OtpCodeField";

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
      <View style={[styles.phoneShell, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <View style={[styles.phoneScreen, { backgroundColor: `${theme.colors.primary}14` }]} />
        <View style={[styles.phoneSpeaker, { backgroundColor: theme.colors.border }]} />
      </View>
      <View style={[styles.checkBubble, { backgroundColor: "#57dd9b" }]}>
        <Feather name="check" size={26} color="#ffffff" />
      </View>
    </View>
  );
}

export function OtpLoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const { step, busy, error, requestOtp, proceedToCode, verifyOtp, goToIdentifierStep, resetError } = useOtpAuth();
  const { theme } = useAppTheme();
  const isOtpStep = step === "sent" || step === "code";

  useEffect(() => {
    if (step === "sent" && code.trim().length > 0) {
      proceedToCode();
    }
  }, [code, proceedToCode, step]);

  return (
    <View style={styles.container}>
      <OtpIllustration />
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>OTP Verification</Text>

      {step === "identifier" && (
        <>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>We will send you one-time password to your email or mobile number</Text>
          <View style={styles.entryBlock}>
            <TextInput
              value={identifier}
              onChangeText={(val) => {
                setIdentifier(val);
                resetError();
              }}
              placeholder="Email or mobile number"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
              style={[styles.identifierInput, { color: theme.colors.textPrimary, borderBottomColor: theme.colors.primary }]}
            />
          </View>
          {error ? <Text style={[styles.inlineError, { color: theme.colors.danger }]}>{error}</Text> : null}
          <Button
            label="Get OTP"
            onPress={() => requestOtp(identifier.trim())}
            loading={busy}
            disabled={identifier.trim().length === 0}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary, borderRadius: 999 }]}
            labelStyle={styles.primaryButtonLabel}
          />
        </>
      )}

      {isOtpStep && (
        <>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Enter the OTP sent to <Text style={[styles.identifierHighlight, { color: theme.colors.textPrimary }]}>{maskIdentifier(identifier)}</Text></Text>
          <Pressable
            onPress={() => {
              setCode("");
              resetError();
              goToIdentifierStep();
            }}
            disabled={busy}
            style={({ pressed }) => [styles.notYouWrap, { opacity: pressed || busy ? 0.7 : 1 }]}
          >
            <Text style={[styles.notYouText, { color: theme.colors.primary }]}>Not you?</Text>
          </Pressable>

          <OtpCodeField
            value={code}
            onChangeText={(val) => {
              setCode(val);
              resetError();
            }}
            editable={!busy}
            active={!busy}
            autoFocus={isOtpStep}
          />

          {error ? <Text style={[styles.inlineError, { color: theme.colors.danger }]}>{error}</Text> : null}

          <View style={styles.resendRow}>
            <Text style={[styles.resendPrompt, { color: theme.colors.textMuted }]}>Didn't you receive the OTP? </Text>
            <Pressable
              onPress={() => requestOtp(identifier.trim())}
              disabled={busy}
              style={({ pressed }) => [{ opacity: pressed || busy ? 0.7 : 1 }]}
            >
              <Text style={[styles.resendLink, { color: theme.colors.primary }]}>Resend OTP</Text>
            </Pressable>
          </View>

          <Button
            label="Verify"
            onPress={() => verifyOtp(identifier.trim(), code.trim())}
            loading={busy}
            disabled={code.trim().length !== 6}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary, borderRadius: 999 }]}
            labelStyle={styles.primaryButtonLabel}
          />
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
  },
  illustrationWrap: {
    width: 170,
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  illustrationRing: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  illustrationRingLarge: {
    position: "absolute",
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  phoneShell: {
    width: 78,
    height: 122,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneScreen: {
    width: 60,
    height: 96,
    borderRadius: 10,
  },
  phoneSpeaker: {
    position: "absolute",
    top: 10,
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  checkBubble: {
    position: "absolute",
    right: 44,
    top: 42,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#57dd9b",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
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
    minHeight: 50,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "left",
    borderBottomWidth: 2,
    paddingHorizontal: 2,
    paddingBottom: 8,
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
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
});
