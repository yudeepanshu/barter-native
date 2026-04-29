import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "expo-router";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";

// ---------------------------------------------------------------------------
// Feature flag
// Set EXPO_PUBLIC_FEEDBACK_ENABLED=true in your .env to show the feedback UI.
// Defaults to false — safe to deploy before the backend endpoint is live.
// ---------------------------------------------------------------------------
const FEEDBACK_ENABLED = process.env.EXPO_PUBLIC_FEEDBACK_ENABLED === "true";

// ---------------------------------------------------------------------------
// Rating scale — 5 fixed integer steps, one emoji per value
// Tapping the selected emoji again clears the rating (acts as a toggle).
// ---------------------------------------------------------------------------
const RATING_STEPS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "Poor" },
  { value: 2, emoji: "😐", label: "Fair" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
  { value: 5, emoji: "😍", label: "Excellent" },
];

const MAX_FEEDBACK_TEXT = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FeedbackPayload {
  positiveFeedback?: string;
  negativeFeedback?: string;
  uiRating?: number;
  uxRating?: number;
}

interface FeedbackFormErrors {
  positiveFeedback?: string;
  negativeFeedback?: string;
  atLeastOne?: string;
  submit?: string;
}

// ---------------------------------------------------------------------------
// EmojiRatingPicker
// A row of 5 emoji buttons. Tap to select; tap selected to deselect.
// ---------------------------------------------------------------------------
interface EmojiRatingPickerProps {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  theme: ReturnType<typeof useAppTheme>["theme"];
}

function EmojiRatingPicker({
  label,
  hint,
  value,
  onChange,
  disabled,
  theme,
}: EmojiRatingPickerProps) {
  return (
    <View style={ratingStyles.wrapper}>
      <View style={ratingStyles.labelRow}>
        <Text style={[ratingStyles.label, { color: theme.colors.textSecondary }]}>
          {label}
          {/* <Text style={[ratingStyles.optional, { color: theme.colors.textMuted }]}>
            {" "}(optional)
          </Text> */}
        </Text>
        {value !== null && (
          <Pressable onPress={() => !disabled && onChange(null)} hitSlop={8} disabled={disabled}>
            <Text style={[ratingStyles.clearText, { color: theme.colors.textMuted }]}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      {hint ? (
        <Text style={[ratingStyles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
      ) : null}

      <View style={ratingStyles.stepsRow}>
        {RATING_STEPS.map((step) => {
          const selected = value === step.value;
          return (
            <Pressable
              key={step.value}
              onPress={() => !disabled && onChange(selected ? null : step.value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${step.label}, ${step.value} out of 5`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                ratingStyles.step,
                {
                  backgroundColor: selected
                    ? theme.colors.primary + "22"
                    : theme.colors.surfaceMuted,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.roundness - 2,
                  borderWidth: selected ? 2 : 1,        // ← thicker border instead of scale
                  opacity: pressed ? 0.8 : 1,
                  // removed transform scale entirely
                },
              ]}
            >
              <Text style={ratingStyles.stepEmoji}>{step.emoji}</Text>
              <Text
                style={[
                  ratingStyles.stepLabel,
                  {
                    color: selected ? theme.colors.primary : theme.colors.textMuted,
                    fontWeight: selected ? "700" : "400",
                  },
                ]}
              >
                {step.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// FeedbackModal
// Sheet-style modal anchored to the bottom of the screen.
// Waits for the API response and surfaces errors inline.
// ---------------------------------------------------------------------------
interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}

function FeedbackModal({ visible, onClose, theme }: FeedbackModalProps) {
  const [positiveFeedback, setPositiveFeedback] = useState("");
  const [negativeFeedback, setNegativeFeedback] = useState("");
  const [uiRating, setUiRating] = useState<number | null>(null);
  const [uxRating, setUxRating] = useState<number | null>(null);
  const [errors, setErrors] = useState<FeedbackFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const resetForm = () => {
    setPositiveFeedback("");
    setNegativeFeedback("");
    setUiRating(null);
    setUxRating(null);
    setErrors({});
    setIsSubmitting(false);
    setSubmitSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): FeedbackFormErrors => {
    const next: FeedbackFormErrors = {};
    const trimPos = positiveFeedback.trim();
    const trimNeg = negativeFeedback.trim();

    if (trimPos.length === 0 && trimNeg.length === 0) {
      next.atLeastOne =
        "Please share at least one of: what went well or what could be improved.";
    }
    if (trimPos.length > MAX_FEEDBACK_TEXT) {
      next.positiveFeedback = `Keep it under ${MAX_FEEDBACK_TEXT} characters (currently ${trimPos.length}).`;
    }
    if (trimNeg.length > MAX_FEEDBACK_TEXT) {
      next.negativeFeedback = `Keep it under ${MAX_FEEDBACK_TEXT} characters (currently ${trimNeg.length}).`;
    }

    return next;
  };

  const onSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: FeedbackPayload = {};
    const trimPos = positiveFeedback.trim();
    const trimNeg = negativeFeedback.trim();

    if (trimPos.length > 0) payload.positiveFeedback = trimPos;
    if (trimNeg.length > 0) payload.negativeFeedback = trimNeg;
    if (uiRating !== null) payload.uiRating = uiRating;
    if (uxRating !== null) payload.uxRating = uxRating;

    setIsSubmitting(true);
    try {
      await mobileApiClient.submitFeedback(payload);
      setSubmitSuccess(true);
    } catch (error) {
      setErrors({ submit: toErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {/* Tapping the dim backdrop closes the modal */}
      <Pressable
        style={[feedbackStyles.backdrop, { backgroundColor: theme.colors.overlay }]}
        onPress={handleClose}
      >
        {/* Inner card — swallows taps so the backdrop press above doesn't fire */}
        <Pressable
          style={[
            feedbackStyles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.roundness,
            },
          ]}
          onPress={() => {}}
        >
          {!submitSuccess ? <View>
            <Text style={[feedbackStyles.title, { color: theme.colors.textPrimary }]}>
              Share your feedback
            </Text>
            <Text style={[feedbackStyles.subtitle, { color: theme.colors.textSecondary }]}>
              Your thoughts help us build a better experience. This takes less than a minute.
            </Text>
          </View> : null}

          {submitSuccess ? (
            /* ── Success state ── */
            <View style={feedbackStyles.successBlock}>
              <Text style={feedbackStyles.successEmoji}>🎉</Text>
              <Text style={[feedbackStyles.successTitle, { color: theme.colors.textPrimary }]}>
                Thank you!
              </Text>
              <Text style={[feedbackStyles.successBody, { color: theme.colors.textSecondary }]}>
                We've received your feedback and will use it to keep improving the app.
              </Text>
              <Button label="Done" onPress={handleClose} />
            </View>
          ) : (
            /* ── Form state ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={feedbackStyles.scrollContent}
            >
              {/* Positive feedback */}
              <Input
                label="What's working well?"
                placeholder="Tell us what you love, anything that delights you…"
                value={positiveFeedback}
                onChangeText={(v) => {
                  setPositiveFeedback(v);
                  setErrors((e) => ({
                    ...e,
                    positiveFeedback: undefined,
                    atLeastOne: undefined,
                  }));
                }}
                error={errors.positiveFeedback ?? null}
                multiline
                numberOfLines={4}
                maxLength={MAX_FEEDBACK_TEXT}
                autoCorrect
                autoCapitalize="sentences"
                editable={!isSubmitting}
              />
              <Text style={[feedbackStyles.charCount, { color: theme.colors.textMuted }]}>
                {positiveFeedback.trim().length} / {MAX_FEEDBACK_TEXT}
              </Text>

              {/* Negative feedback */}
              <Input
                label="What could be better?"
                placeholder="Friction points, bugs, confusing flows, missing features..."
                value={negativeFeedback}
                onChangeText={(v) => {
                  setNegativeFeedback(v);
                  setErrors((e) => ({
                    ...e,
                    negativeFeedback: undefined,
                    atLeastOne: undefined,
                  }));
                }}
                error={errors.negativeFeedback ?? null}
                multiline
                numberOfLines={4}
                maxLength={MAX_FEEDBACK_TEXT}
                autoCorrect
                autoCapitalize="sentences"
                editable={!isSubmitting}
              />
              <Text style={[feedbackStyles.charCount, { color: theme.colors.textMuted }]}>
                {negativeFeedback.trim().length} / {MAX_FEEDBACK_TEXT}
              </Text>

              {/* At-least-one validation error */}
              {errors.atLeastOne ? (
                <Text style={[feedbackStyles.errorText, { color: theme.colors.danger }]}>
                  {errors.atLeastOne}
                </Text>
              ) : null}

              {/* UI Rating */}
              <EmojiRatingPicker
                label="How would you rate the visual design?"
                // hint="Layout, colours, typography, and how the app looks overall."
                value={uiRating}
                onChange={setUiRating}
                disabled={isSubmitting}
                theme={theme}
              />

              {/* UX Rating */}
              <EmojiRatingPicker
                label="How easy is the app to use?"
                // hint="Navigation, flows, and how intuitive everyday interactions feel."
                value={uxRating}
                onChange={setUxRating}
                disabled={isSubmitting}
                theme={theme}
              />

              {/* Submit-level error (network, quota exceeded, etc.) */}
              {errors.submit ? (
                <Text style={[feedbackStyles.errorText, { color: theme.colors.danger }]}>
                  {errors.submit}
                </Text>
              ) : null}

              {/* Actions */}
              <View style={feedbackStyles.actions}>
                <Button
                  label="Submit feedback"
                  onPress={() => void onSubmit()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={handleClose}
                  disabled={isSubmitting}
                />
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers (unchanged from original)
// ---------------------------------------------------------------------------
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
  if (fromConfig) return `Version ${fromConfig}`;
  return "Version unavailable";
}

type ProfilePicturePickMode = "deferred" | "direct";

// ---------------------------------------------------------------------------
// ProfileScreen
// ---------------------------------------------------------------------------
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const status = useAuthStatus();
  const session = useSession();
  const profileQuery = useProfileQuery(status === "authenticated");
  const { signOut, busy } = useOtpAuth();
  const updateProfileMutation = useUpdateProfileMutation();
  const { theme, statusBarStyle, preference, resolvedMode, setPreference } = useAppTheme();
  const navigation = useNavigation();
  const dialog = useAppDialog();
  const sessionUser = session?.user ?? null;
  const queriedUser = profileQuery.data ?? null;
  const user =
    queriedUser && sessionUser && queriedUser.id === sessionUser.id
      ? queriedUser
      : sessionUser ?? queriedUser;
  const appVersionLabel = useMemo(() => getCurrentVersionLabel(), []);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });

    return unsubscribe;
  }, [navigation]);

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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    userName?: string;
    email?: string;
    mobileNumber?: string;
  }>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setUserName(user.userName ?? "");
    setEmail(user.email ?? "");
    setMobileNumber(user.mobileNumber ?? "");
    setFieldErrors({});
    setPendingProfileAsset(null);
    setPendingProfileFileName(null);
    setIsEditing(false);
  }, [user]);

  const isDirty = useMemo(() => {
    if (!user) return false;
    return (
      userName.trim() !== (user.userName ?? "") ||
      email.trim() !== (user.email ?? "") ||
      mobileNumber.trim() !== (user.mobileNumber ?? "") ||
      pendingProfileAsset != null
    );
  }, [email, mobileNumber, pendingProfileAsset, user, userName]);

  const onReset = () => {
    if (!user) return;
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
    profileQuery.refetch().finally(() => setIsManualRefreshing(false));
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

    // if (hasExistingValue(user?.email) && trimmedEmail.length === 0) {
    //   nextErrors.email = "Email cannot be empty once set.";
    // } else if (trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)) {
    //   nextErrors.email = "Enter a valid email address.";
    // }

    // if (hasExistingValue(user?.mobileNumber) && trimmedPhone.length === 0) {
    //   nextErrors.mobileNumber = "Phone number cannot be empty once set.";
    // } else if (
    //   trimmedPhone.length > 0 &&
    //   (trimmedPhone.length < 10 || trimmedPhone.length > 15)
    // ) {
    //   nextErrors.mobileNumber = "Phone number must be 10 to 15 digits.";
    // }

    if (!hasExistingValue(user?.email)) {
      if (trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)) {
        nextErrors.email = "Enter a valid email address.";
      }
    }

    if (!hasExistingValue(user?.mobileNumber)) {
      if (
        trimmedPhone.length > 0 &&
        (trimmedPhone.length < 10 || trimmedPhone.length > 15)
      ) {
        nextErrors.mobileNumber = "Phone number must be 10 to 15 digits.";
      }
    }

    setFieldErrors(nextErrors);
    setFormMessage(null);

    if (Object.keys(nextErrors).length > 0 || !user) return;

    try {
      let nextProfilePicture: string | undefined;
      if (pendingProfileAsset) {
        setIsUploadingPhoto(true);
        const fileName =
          pendingProfileFileName ??
          pendingProfileAsset.fileName ??
          `profile-${Date.now()}.jpg`;
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

  const uploadProfilePictureAsset = async (asset: ImagePickerAsset, fileName: string) => {
    const uploadEnvelope = await mobileApiClient.generateProfilePictureUploadUrl(fileName);
    const upload = uploadEnvelope.data;
    if (!upload) throw new Error("Could not generate upload URL");
    await uploadImageAssetToPresignedUrl({ asset, signedUrl: upload.signedUrl, fileName });
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

      const source =
        sourceAction === "camera" || sourceAction === "library" ? sourceAction : null;
      if (!source) return;

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
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });
      }

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) throw new Error("No image selected");

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
      if (mode === "direct") setIsUploadingPhoto(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <View style={styles.center}>
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <StatusBar style={statusBarStyle} />
      <View style={styles.fixedTopContent}>
        <PageHeaderCard
          title="Profile"
          subtitle="Update your account details and personalization settings."
        />
      </View>
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={12}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 78 }]}
        scrollRef={scrollViewRef}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={onManualRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <AppCard title="Appearance" subtitle={`Currently using ${resolvedMode} mode.`}>
          <SegmentedControl value={preference} options={THEME_OPTIONS} onChange={setPreference} />
        </AppCard>

        {profileQuery.isPending ? (
          <View style={styles.center}>
            <Spinner size={28} />
          </View>
        ) : user ? (
          <>
            {profileQuery.error && !profileQuery.data ? (
              <View
                style={[
                  styles.serverWarningCard,
                  {
                    borderColor: theme.colors.warningSoft,
                    backgroundColor: theme.colors.warningSoft,
                  },
                ]}
              >
                <Text
                  style={[styles.serverWarningText, { color: theme.colors.textSecondary }]}
                >
                  Could not refresh the latest profile from the server. You can still edit using
                  your saved account info.
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
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Edit details
                </Text>

                <Button
                  label="Change profile picture"
                  variant="ghost"
                  onPress={() => void onSelectProfilePicture()}
                  loading={false}
                  disabled={updateProfileMutation.isPending || isUploadingPhoto}
                />

                {pendingProfileAsset ? (
                  <Text style={[styles.pendingPhotoText, { color: theme.colors.textMuted }]}>
                    New photo selected. It will upload on save.
                  </Text>
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
                  editable={!hasExistingValue(user?.email)}
                  disabled={hasExistingValue(user?.email)}
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
                  editable={!hasExistingValue(user?.mobileNumber)}
                  disabled={hasExistingValue(user?.mobileNumber)}
                />

                {formMessage ? (
                  <Text
                    style={[
                      styles.formMessage,
                      {
                        color: updateProfileMutation.isError
                          ? theme.colors.danger
                          : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {formMessage}
                  </Text>
                ) : null}

                <View style={styles.formActions}>
                  <View style={styles.formActionsRow}>
                    <Pressable
                      onPress={() => {
                        if (!isDirty || updateProfileMutation.isPending || isUploadingPhoto)
                          return;
                        onReset();
                      }}
                      disabled={!isDirty || updateProfileMutation.isPending || isUploadingPhoto}
                      accessibilityRole="button"
                      android_ripple={{
                        color:
                          theme.mode === "dark"
                            ? "rgba(248, 113, 113, 0.14)"
                            : "rgba(220, 38, 38, 0.08)",
                      }}
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
                        style={[styles.resetButtonLabel, { color: theme.colors.danger }]}
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
            <SessionCard
              user={session.user}
              onSignOut={() => void signOut()}
              signingOut={busy}
            />
            <Button
              label="Refresh profile"
              variant="ghost"
              onPress={() => void profileQuery.refetch()}
            />
          </View>
        )}

        {/* ----------------------------------------------------------------
            Feedback teaser
            Gated by EXPO_PUBLIC_FEEDBACK_ENABLED env var (default: false).
            Shown at the bottom of the screen, above the version footer.
        ---------------------------------------------------------------- */}
        {FEEDBACK_ENABLED ? (
          <Pressable
            onPress={() => setShowFeedbackModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Open feedback form"
            style={[
              styles.feedbackTeaser,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.roundness,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            {/* Icon */}
            <View style={[styles.feedbackIconCircle, { backgroundColor: theme.colors.surfaceMuted ?? '#EEF2FF' }]}>
              <MaterialCommunityIcons
                name="message-text-outline"
                size={22}
                color={theme.colors.primary}
              />
            </View>

            {/* Texts */}
            <View style={styles.feedbackTextGroup}>
              <Text style={[styles.feedbackTeaserTitle, { color: theme.colors.textPrimary }]}>
                Feedback
              </Text>
              <Text style={[styles.feedbackTeaserBody, { color: theme.colors.textSecondary }]}>
                Tell us what you think of our App
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.versionFooter}>
          <Text style={[styles.versionText, { color: theme.colors.textMuted }]}>
            {appVersionLabel}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* ----------------------------------------------------------------
          Photo preview modal (unchanged from original)
      ---------------------------------------------------------------- */}
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
            <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]}>
              Profile picture
            </Text>
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
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                  onError={() => setPreviewLoadFailed(true)}
                />
              </Pressable>
            ) : (
              <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>
                Profile picture not available.
              </Text>
            )}
            {user?.profilePicture && !previewLoadFailed ? (
              <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>
                Tap the image to update profile picture.
              </Text>
            ) : (
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
            )}
            <Button
              label="Close"
              variant="ghost"
              onPress={() => setShowPhotoPreview(false)}
            />
          </View>
        </Pressable>
      </Modal>

      {/* ----------------------------------------------------------------
          Feedback modal — only mounted when flag is on
      ---------------------------------------------------------------- */}
      {FEEDBACK_ENABLED ? (
        <FeedbackModal
          visible={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          theme={theme}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles — EmojiRatingPicker
// ---------------------------------------------------------------------------
const ratingStyles = StyleSheet.create({
  wrapper: { gap: 8 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 13.5, fontWeight: "600" },
  optional: { fontWeight: "400" },
  hint: { fontSize: 12, lineHeight: 17 },
  clearText: { fontSize: 12, textDecorationLine: "underline" },
  stepsRow: { flexDirection: "row", gap: 6, paddingHorizontal: 1 },
  step: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    gap: 4,
  },
  stepEmoji: { fontSize: 22 },
  stepLabel: { fontSize: 10, textAlign: "center" },
});

// ---------------------------------------------------------------------------
// Styles — FeedbackModal
// ---------------------------------------------------------------------------
const feedbackStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  card: {
    width: "100%",
    maxHeight: "90%",
    borderWidth: 1,
    // Bottom corners are flush with screen edge (sheet style)
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    paddingBottom: 0,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 13.5, lineHeight: 20 },
  scrollContent: { gap: 14, paddingBottom: 36 },
  charCount: { fontSize: 11, textAlign: "right", marginTop: -8 },
  errorText: { fontSize: 13, lineHeight: 18 },
  actions: { gap: 10, marginTop: 4 },
  successBlock: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
    paddingBottom: 36,
  },
  successEmoji: { fontSize: 48 },
  successTitle: { fontSize: 20, fontWeight: "800" },
  successBody: { fontSize: 14, lineHeight: 21, textAlign: "center" },
});

// ---------------------------------------------------------------------------
// Styles — ProfileScreen
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fixedTopContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    marginBottom: -8,
  },
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
    overflow: "visible",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  formMessage: { fontSize: 13 },
  pendingPhotoText: { fontSize: 12 },
  // ── Feedback teaser ──
  feedbackTeaser: {
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',       // icon + text side by side
    alignItems: 'center',
    gap: 14,
  },
  feedbackIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,              // prevent icon from shrinking
  },
  feedbackTextGroup: {
    flex: 1,                    // take remaining width
    gap: 3,
  },
  feedbackTeaserTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  feedbackTeaserBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackTeaserLink: { fontWeight: '700' },
  // ── Version footer ──
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
  // ── Profile edit form ──
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
  // ── Photo preview modal ──
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
  previewImageButton: { borderRadius: 110 },
  previewHint: { fontSize: 13, textAlign: "center" },
  previewUploadText: {
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});