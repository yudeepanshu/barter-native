import {
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
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
import { AppImage } from "@/components/ui/AppImage";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";
import { useAppDialog } from "@/providers/AppDialogProvider";

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function hasExistingValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function getCurrentVersionLabel() {
  const fromConfig = Constants.expoConfig?.version?.trim();
  if (fromConfig) {
    return `Version ${fromConfig}`;
  }

  return "Version unavailable";
}

type ProfilePicturePickMode = "deferred" | "direct";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const status = useAuthStatus();
  const session = useSession();
  const profileQuery = useProfileQuery(status === "authenticated");
  const { signOut, busy } = useOtpAuth();
  const updateProfileMutation = useUpdateProfileMutation();
  const { theme, statusBarStyle, preference, resolvedMode, setPreference } = useAppTheme();
  const dialog = useAppDialog();
  const sessionUser = session?.user ?? null;
  const queriedUser = profileQuery.data ?? null;
  const user = queriedUser && sessionUser && queriedUser.id === sessionUser.id ? queriedUser : sessionUser ?? queriedUser;
  const appVersionLabel = useMemo(() => getCurrentVersionLabel(), []);

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [pendingProfileAsset, setPendingProfileAsset] = useState<ImagePickerAsset | null>(null);
  const [pendingProfileFileName, setPendingProfileFileName] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
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

  const onManualRefresh = () => {
    setIsManualRefreshing(true);
    profileQuery
      .refetch()
      .finally(() => {
        setIsManualRefreshing(false);
      });
  };

  const onSave = async () => {
    const nextErrors: typeof fieldErrors = {};
    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = normalizePhone(mobileNumber);

    if (hasExistingValue(user?.userName) && trimmedUserName.length === 0) {
      nextErrors.userName = "Name cannot be empty once set.";
    } else if (trimmedUserName.length < 3) {
      nextErrors.userName = "Name must be at least 3 characters.";
    }

    if (hasExistingValue(user?.email) && trimmedEmail.length === 0) {
      nextErrors.email = "Email cannot be empty once set.";
    } else if (trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (hasExistingValue(user?.mobileNumber) && trimmedPhone.length === 0) {
      nextErrors.mobileNumber = "Phone number cannot be empty once set.";
    } else if (trimmedPhone.length > 0 && (trimmedPhone.length < 10 || trimmedPhone.length > 15)) {
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
        nextProfilePicture = await uploadProfilePictureAsset(pendingProfileAsset, fileName);
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

  const uploadProfilePictureAsset = async (
    asset: ImagePickerAsset,
    fileName: string,
  ) => {
    const uploadEnvelope = await mobileApiClient.generateProfilePictureUploadUrl(fileName);
    const upload = uploadEnvelope.data;
    if (!upload) {
      throw new Error("Could not generate upload URL");
    }

    await uploadImageAssetToPresignedUrl({
      asset,
      signedUrl: upload.signedUrl,
      fileName,
    });

    return upload.publicUrl;
  };

  const onSelectProfilePicture = async (mode: ProfilePicturePickMode = "deferred") => {
    setFormMessage(null);

    try {
      const sourceAction = await dialog.show({
        title: "Choose profile photo",
        message: "Select how you want to set your photo.",
        showCloseButton: true,
        actions: [
          { key: "camera", label: "Camera" },
          { key: "library", label: "Gallery" },
        ],
      });

      const source = sourceAction === "camera" || sourceAction === "library" ? sourceAction : null;

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
          quality: 1,
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
          quality: 1,
          shouldDownloadFromNetwork: true,
          preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });
      }

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        throw new Error("No image selected");
      }

      const fileName = asset.fileName ?? `profile-${Date.now()}.jpg`;

      if (mode === "direct") {
        setIsUploadingPhoto(true);
        const profilePicture = await uploadProfilePictureAsset(asset, fileName);
        await updateProfileMutation.mutateAsync({ profilePicture });
        setPendingProfileAsset(null);
        setPendingProfileFileName(null);
        setFormMessage("Profile picture updated.");
        return;
      }

      setPendingProfileAsset(asset);
      setPendingProfileFileName(fileName);
      setFormMessage("Photo selected. Save changes to upload it.");
    } catch (error) {
      setFormMessage(toUploadErrorMessage(error, toErrorMessage));
    } finally {
      if (mode === "direct") {
        setIsUploadingPhoto(false);
      }
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
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={12}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 78 }]}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={onManualRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <AppCard title="Profile" subtitle="Update your account details and personalization settings." />

        <AppCard
          title="Appearance"
          subtitle={`Currently using ${resolvedMode} mode.`}
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
                setFormMessage(null);
                setPreviewLoadFailed(false);
                if (!user.profilePicture) {
                  void onSelectProfilePicture("direct");
                  return;
                }

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
                  <View style={styles.formActionsRow}>
                    <Pressable
                      onPress={() => {
                        if (!isDirty || updateProfileMutation.isPending || isUploadingPhoto) {
                          return;
                        }
                        onReset();
                      }}
                      disabled={!isDirty || updateProfileMutation.isPending || isUploadingPhoto}
                      accessibilityRole="button"
                      android_ripple={{ color: theme.mode === "dark" ? "rgba(248, 113, 113, 0.14)" : "rgba(220, 38, 38, 0.08)" }}
                      style={({ pressed }) => [
                        styles.formActionCell,
                        styles.resetButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surfaceMuted,
                          borderRadius: theme.roundness - 4,
                          opacity:
                            !isDirty || updateProfileMutation.isPending || isUploadingPhoto
                              ? 0.86
                              : pressed
                                ? 0.94
                                : 1,
                          transform: [{ scale: pressed ? 0.99 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.resetButtonLabel,
                          {
                            color: theme.colors.danger,
                          },
                        ]}
                      >
                        Reset
                      </Text>
                    </Pressable>
                    <View style={styles.formActionCell}>
                      <Button
                        label="Update"
                        onPress={() => void onSave()}
                        loading={updateProfileMutation.isPending}
                        disabled={!isDirty || isUploadingPhoto}
                      />
                    </View>
                  </View>
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

        <View style={styles.versionFooter}>
          <Text style={[styles.versionText, { color: theme.colors.textMuted }]}>{appVersionLabel}</Text>
        </View>

      </KeyboardAwareScrollView>

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
              <Pressable
                onPress={() => {
                  setShowPhotoPreview(false);
                  void onSelectProfilePicture("direct");
                }}
                hitSlop={8}
                style={styles.previewImageButton}
              >
                <AppImage
                  uri={user.profilePicture}
                  style={[
                    styles.previewImage,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                  onError={() => setPreviewLoadFailed(true)}
                />
              </Pressable>
            ) : (
              <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>Profile picture not available.</Text>
            )}
            {user?.profilePicture && !previewLoadFailed ? (
              <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>
                Tap the image to update profile picture.
              </Text>
            ) : (
              <>
                <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>
                  Please{" "}
                  <Text
                    style={[styles.previewUploadText, { color: theme.colors.primary }]}
                    onPress={() => {
                      setShowPhotoPreview(false);
                      void onSelectProfilePicture("direct");
                    }}
                  >
                    upload
                  </Text>{" "}
                  a profile picture.
                </Text>
              </>
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
  keyboardWrap: { flex: 1 },
  content: { flexGrow: 1, padding: 16, gap: 12 },
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
  versionFooter: {
    marginTop: "auto",
    paddingTop: 12,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    textAlign: "center",
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  formActions: { gap: 10 },
  formActionsRow: { flexDirection: "row", gap: 10 },
  formActionCell: { flex: 1 },
  resetButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  resetButtonLabel: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
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
  },
  previewImageButton: {
    borderRadius: 110,
  },
  previewHint: { fontSize: 13, textAlign: "center" },
  previewUploadText: { fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
});
