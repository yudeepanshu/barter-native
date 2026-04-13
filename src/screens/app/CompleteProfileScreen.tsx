import { useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AppCard } from "@/components/ui/AppCard";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/lib/auth/authStore";
import { mobileApiClient } from "@/lib/api/client";
import { validateDisplayName } from "@/lib/auth/profileCompletion";

export default function CompleteProfileScreen() {
  const { theme, statusBarStyle } = useAppTheme();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  // Snapshot window height before any keyboard event so minHeight never changes
  // when Android shrinks the viewport in adjustResize mode.
  const minHeight = useRef(Dimensions.get("window").height).current;

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSave = async () => {
    const validationError = validateDisplayName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!session) {
      setError("Session expired. Please login again.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const normalized = name.trim().replace(/\s+/g, " ");
      const envelope = await mobileApiClient.updateCurrentUser({ userName: normalized });
      const updatedUser = envelope.data;

      if (!updatedUser) {
        throw new Error("Profile update failed. Please try again.");
      }

      setSession({
        user: updatedUser,
        tokens: session.tokens,
      });

      router.replace("/(app)/(tabs)/home");
    } catch (updateError) {
      setError(
        updateError instanceof Error && updateError.message
          ? updateError.message
          : "Could not save your name right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={16}
        contentContainerStyle={[styles.content, { minHeight }]}
      >
        <AppCard
          title="Complete signup"
          subtitle="Enter your name to finish creating your account."
        >
          <View style={styles.form}>
            <Input
              label="Full name"
              placeholder="e.g., Rohan Sharma"
              value={name}
              onChangeText={(value) => {
                setName(value);
                if (error) {
                  setError(null);
                }
              }}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              showCharacterCount
              error={error}
            />

            <Button
              label="Continue"
              onPress={() => void onSave()}
              loading={isSaving}
              disabled={name.trim().length === 0}
            />
          </View>
        </AppCard>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardWrap: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingBottom: 28,
  },
  form: { gap: 12 },
});
