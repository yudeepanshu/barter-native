import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";
import { useAuthStatus, useSession } from "@/hooks/useSession";
import { useProfileQuery } from "@/hooks/queries/useProfileQuery";
import { useOtpAuth } from "@/hooks/useOtpAuth";
import { SessionCard } from "@/components/auth/SessionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { mobileApiClient } from "@/lib/api/client";
import {
  toErrorMessage,
  useUpdateProfileMutation,
} from "@/hooks/mutations/useUpdateProfileMutation";
import {
  toUploadErrorMessage,
  uploadImageAssetToPresignedUrl,
} from "@/lib/uploads/presignedImageUpload";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ThemePreference } from "@/theme/appTheme";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AppCard } from "@/components/ui/AppCard";

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export default function ProfileScreen() {
  const status = useAuthStatus();
  const session = useSession();
  const profileQuery = useProfileQuery(status === "authenticated");
  const { signOut, busy } = useOtpAuth();
  const updateProfileMutation = useUpdateProfileMutation();
  const { theme, statusBarStyle, preference, resolvedMode, setPreference } = useAppTheme();
  const user = profileQuery.data ?? session?.user ?? null;

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [pendingProfileAsset, setPendingProfileAsset] = useState<ImagePickerAsset | null>(null);
  const [pendingProfileFileName, setPendingProfileFileName] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    userName?: string;
    email?: string;
    mobileNumber?: string;
  }>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setUserName(user.userName ?? "");
    setEmail(user.email ?? "");
    setMobileNumber(user.mobileNumber ?? "");
    setFieldErrors({});
    setPendingProfileAsset(null);
    setPendingProfileFileName(null);
    setIsEditing(false);
  }, [user]);

  const isDirty = useMemo(() => {
    if (!user) {
      return false;
    }

    return (
      userName.trim() !== (user.userName ?? "") ||
      email.trim() !== (user.email ?? "") ||
      mobileNumber.trim() !== (user.mobileNumber ?? "") ||
      pendingProfileAsset != null
    );
  }, [email, mobileNumber, pendingProfileAsset, user, userName]);

  const onReset = () => {
    if (!user) {
      return;
    }

    setUserName(user.userName ?? "");
    setEmail(user.email ?? "");
    setMobileNumber(user.mobileNumber ?? "");
    setPendingProfileAsset(null);
    setPendingProfileFileName(null);
    setFieldErrors({});
    setFormMessage(null);
  };

  const onSave = async () => {
    const nextErrors: typeof fieldErrors = {};
    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = normalizePhone(mobileNumber);

    if (trimmedUserName.length < 3) {
      nextErrors.userName = "Name must be at least 3 characters.";
    }

    if (trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (trimmedPhone.length > 0 && (trimmedPhone.length < 10 || trimmedPhone.length > 15)) {
      nextErrors.mobileNumber = "Phone number must be 10 to 15 digits.";
    }

    setFieldErrors(nextErrors);
    setFormMessage(null);

    if (Object.keys(nextErrors).length > 0 || !user) {
      return;
    }

    try {
      let nextProfilePicture: string | undefined;
      if (pendingProfileAsset) {
        setIsUploadingPhoto(true);
        const fileName =
          pendingProfileFileName ?? pendingProfileAsset.fileName ?? `profile-${Date.now()}.jpg`;
        const uploadEnvelope = await mobileApiClient.generateProfilePictureUploadUrl(fileName);
        const upload = uploadEnvelope.data;
        if (!upload) {
          throw new Error("Could not generate upload URL");
        }

        await uploadImageAssetToPresignedUrl({
          asset: pendingProfileAsset,
          signedUrl: upload.signedUrl,
          fileName,
        });
        nextProfilePicture = upload.publicUrl;
      }

      await updateProfileMutation.mutateAsync({
        userName: trimmedUserName,
        email: trimmedEmail.length > 0 ? trimmedEmail : null,
        mobileNumber: trimmedPhone.length > 0 ? trimmedPhone : null,
        ...(nextProfilePicture ? { profilePicture: nextProfilePicture } : {}),
      });
      setFormMessage("Profile updated.");
      setPendingProfileAsset(null);
      setPendingProfileFileName(null);
      setIsEditing(false);
    } catch (error) {
      setFormMessage(toErrorMessage(error));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const onSelectProfilePicture = async () => {
    setFormMessage(null);

    try {
      const source = await new Promise<"camera" | "library" | null>((resolve) => {
        Alert.alert("Choose profile photo", "Select how you want to set your photo.", [
          { text: "Camera", onPress: () => resolve("camera") },
          { text: "Gallery", onPress: () => resolve("library") },
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        ]);
      });

      if (!source) {
        return;
      }

      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          setFormMessage("Camera permission is required to capture a profile photo.");
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
      } else {
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          setFormMessage("Media library permission is required to choose a profile photo.");
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
      }

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        throw new Error("No image selected");
      }

      setPendingProfileAsset(asset);
      setPendingProfileFileName(asset.fileName ?? `profile-${Date.now()}.jpg`);
      setFormMessage("Photo selected. Save changes to upload it.");
    } catch (error) {
      setFormMessage(toUploadErrorMessage(error, toErrorMessage));
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={profileQuery.isRefetching}
            onRefresh={() => void profileQuery.refetch()}
            tintColor={theme.colors.primary}
          />
        }
      >
        <AppCard title="Profile" subtitle="Update your account details and personalization settings." />

        <AppCard
          title="Appearance"
          subtitle={`Following ${resolvedMode} mode. System is the default behavior.`}
        >
          <SegmentedControl value={preference} options={THEME_OPTIONS} onChange={setPreference} />
        </AppCard>

        {profileQuery.isPending ? (
          <View style={styles.center}>
            <Spinner size={28} />
          </View>
        ) : user ? (
          <>
            {profileQuery.error && !profileQuery.data ? (
              <View style={[styles.serverWarningCard, { borderColor: theme.colors.warningSoft, backgroundColor: theme.colors.warningSoft }]}>
                <Text style={[styles.serverWarningText, { color: theme.colors.textSecondary }]}>
                  Could not refresh the latest profile from the server. You can still edit using your
                  saved account info.
                </Text>
                <Button
                  label="Refresh profile"
                  variant="ghost"
                  onPress={() => void profileQuery.refetch()}
                />
              </View>
            ) : null}

            <SessionCard
              user={user}
              onSignOut={() => void signOut()}
              signingOut={busy}
              onAvatarPress={() => {
                setPreviewLoadFailed(false);
                setShowPhotoPreview(true);
              }}
              onEditPress={() => {
                setFormMessage(null);
                setIsEditing(true);
              }}
            />

            {isEditing ? (
              <View
                style={[
                  styles.formCard,
                  {
                    borderColor: theme.colors.border,
                    borderRadius: theme.roundness,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Edit details</Text>

                <Button
                  label="Change profile picture"
                  variant="ghost"
                  onPress={() => void onSelectProfilePicture()}
                  loading={false}
                  disabled={updateProfileMutation.isPending || isUploadingPhoto}
                />

                {pendingProfileAsset ? (
                  <Text style={[styles.pendingPhotoText, { color: theme.colors.textMuted }]}>New photo selected. It will upload on save.</Text>
                ) : null}

                <Input
                  label="Name"
                  value={userName}
                  onChangeText={(value) => {
                    setUserName(value);
                    setFormMessage(null);
                  }}
                  error={fieldErrors.userName ?? null}
                  autoCapitalize="words"
                />

                <Input
                  label="Email"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setFormMessage(null);
                  }}
                  error={fieldErrors.email ?? null}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  placeholder="Optional"
                />

                <Input
                  label="Phone number"
                  value={mobileNumber}
                  onChangeText={(value) => {
                    setMobileNumber(value);
                    setFormMessage(null);
                  }}
                  error={fieldErrors.mobileNumber ?? null}
                  keyboardType="phone-pad"
                  placeholder="Optional"
                />

                {formMessage ? (
                  <Text
                    style={[
                      styles.formMessage,
                      { color: updateProfileMutation.isError ? theme.colors.danger : theme.colors.textSecondary },
                    ]}
                  >
                    {formMessage}
                  </Text>
                ) : null}

                <View style={styles.formActions}>
                  <Button
                    label="Save changes"
                    onPress={() => void onSave()}
                    loading={updateProfileMutation.isPending}
                    disabled={!isDirty || isUploadingPhoto}
                  />
                  <Button
                    label="Reset"
                    variant="ghost"
                    onPress={onReset}
                    disabled={!isDirty || updateProfileMutation.isPending || isUploadingPhoto}
                  />
                  <Button
                    label="Close"
                    variant="ghost"
                    onPress={() => {
                      onReset();
                      setIsEditing(false);
                    }}
                    disabled={updateProfileMutation.isPending || isUploadingPhoto}
                  />
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.errorCard}>
            <SessionCard user={session.user} onSignOut={() => void signOut()} signingOut={busy} />
            <Button
              label="Refresh profile"
              variant="ghost"
              onPress={() => void profileQuery.refetch()}
            />
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showPhotoPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoPreview(false)}
      >
        <Pressable
          style={[styles.previewBackdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setShowPhotoPreview(false)}
        >
          <View
            style={[
              styles.previewCard,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.roundness,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]}>Profile picture</Text>
            {user?.profilePicture && !previewLoadFailed ? (
              <Image
                source={{ uri: user.profilePicture }}
                style={styles.previewImage}
                onError={() => setPreviewLoadFailed(true)}
              />
            ) : (
              <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>Image not accessible from this URL.</Text>
            )}
            <Button label="Close" variant="ghost" onPress={() => setShowPhotoPreview(false)} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  center: { paddingTop: 40, alignItems: "center" },
  errorCard: { gap: 10 },
  serverWarningCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  serverWarningText: { fontSize: 13, lineHeight: 19 },
  formCard: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  formMessage: { fontSize: 13 },
  pendingPhotoText: { fontSize: 12 },
  formActions: { gap: 10 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    alignItems: "center",
  },
  previewTitle: { fontSize: 16, fontWeight: "800" },
  previewImage: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  previewHint: { fontSize: 13, textAlign: "center" },
});
