import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useOtpAuth } from "@/hooks/useOtpAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function OtpLoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const { step, busy, error, requestOtp, verifyOtp, goToIdentifierStep, resetError } = useOtpAuth();

  return (
    <View style={styles.container}>
      <Input
        label="Email or 10-digit phone"
        value={identifier}
        onChangeText={(val) => {
          setIdentifier(val);
          resetError();
        }}
        placeholder="you@example.com or 9876543210"
        autoCapitalize="none"
        keyboardType="email-address"
        editable={step !== "code"}
        error={step === "identifier" ? error : null}
      />

      {step === "code" && (
        <Input
          label="OTP code"
          value={code}
          onChangeText={(val) => {
            setCode(val);
            resetError();
          }}
          placeholder="6-digit code"
          keyboardType="number-pad"
          maxLength={6}
          error={error}
        />
      )}

      {step === "identifier" ? (
        <Button
          label="Send OTP"
          onPress={() => requestOtp(identifier.trim())}
          loading={busy}
          disabled={identifier.trim().length === 0}
        />
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              label="Verify OTP"
              variant="success"
              onPress={() => verifyOtp(identifier.trim(), code.trim())}
              loading={busy}
              disabled={code.trim().length !== 6}
            />
          </View>
          <Button
            label="Change"
            variant="ghost"
            onPress={() => {
              setCode("");
              goToIdentifierStep();
            }}
            disabled={busy}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
