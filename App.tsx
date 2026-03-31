import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ApiClient } from "@barter/api-client";
import type { AuthUser } from "@barter/types";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mobileApiClient } from "./src/lib/api/client";
import { mobileTokenStore } from "./src/lib/auth/tokenStore";

export default function App() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState("Ready");
  const [busy, setBusy] = useState<"request" | "verify" | null>(null);

  const requestOtp = async () => {
    setBusy("request");
    setNotice("Sending OTP...");

    try {
      const response = await mobileApiClient.requestOtp({ identifier: identifier.trim() });
      setNotice(response.message ?? "OTP sent");
    } catch (error) {
      const mapped = ApiClient.toApiError(error);
      setNotice(`Error: ${mapped.message}`);
    } finally {
      setBusy(null);
    }
  };

  const verifyOtp = async () => {
    setBusy("verify");
    setNotice("Verifying OTP...");

    try {
      const response = await mobileApiClient.verifyOtp({
        identifier: identifier.trim(),
        code: code.trim(),
      });

      const payload = response.data;

      if (!payload?.tokens || !payload.user) {
        setNotice("Error: Invalid login response");
        return;
      }

      await mobileTokenStore.setTokens(payload.tokens);
      setUser(payload.user);
      setCode("");
      setNotice(response.message ?? "Logged in");
    } catch (error) {
      const mapped = ApiClient.toApiError(error);
      setNotice(`Error: ${mapped.message}`);
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await mobileTokenStore.clearTokens();
    setUser(null);
    setCode("");
    setNotice("Signed out");
  };

  const requestDisabled = identifier.trim().length === 0 || busy !== null;
  const verifyDisabled =
    identifier.trim().length === 0 || code.trim().length !== 6 || busy !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.heading}>Barter Auth Foundation</Text>
          <Text style={styles.subtitle}>Mobile OTP flow backed by shared API contracts.</Text>

          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email or 10-digit phone"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="OTP code"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.darkButton, requestDisabled && styles.disabledButton]}
              onPress={requestOtp}
              disabled={requestDisabled}
            >
              <Text style={styles.buttonText}>
                {busy === "request" ? "Sending..." : "Request OTP"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.greenButton, verifyDisabled && styles.disabledButton]}
              onPress={verifyOtp}
              disabled={verifyDisabled}
            >
              <Text style={styles.buttonText}>
                {busy === "verify" ? "Verifying..." : "Verify OTP"}
              </Text>
            </Pressable>

            <Pressable style={[styles.button, styles.lightButton]} onPress={signOut}>
              <Text style={styles.lightButtonText}>Sign out</Text>
            </Pressable>
          </View>

          <Text
            style={[
              styles.notice,
              notice.startsWith("Error") ? styles.errorText : styles.successText,
            ]}
          >
            {notice}
          </Text>

          {busy ? <ActivityIndicator style={styles.loader} size="small" color="#0f172a" /> : null}

          {user ? (
            <View style={styles.sessionCard}>
              <Text style={styles.sessionHeading}>Session</Text>
              <Text style={styles.sessionText}>Name: {user.userName}</Text>
              <Text style={styles.sessionText}>User ID: {user.id}</Text>
              <Text style={styles.sessionText}>Email: {user.email ?? "N/A"}</Text>
              <Text style={styles.sessionText}>Phone: {user.mobileNumber ?? "N/A"}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  button: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  darkButton: {
    backgroundColor: "#0f172a",
  },
  greenButton: {
    backgroundColor: "#047857",
  },
  lightButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  disabledButton: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  lightButtonText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  notice: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  successText: {
    color: "#166534",
  },
  errorText: {
    color: "#b91c1c",
  },
  loader: {
    marginTop: 4,
  },
  sessionCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sessionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  sessionText: {
    fontSize: 13,
    color: "#334155",
  },
});
