import { validateCreateListingDraft } from "@barter/types";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Button } from "@/components/ui/Button";
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useCreateListingForm } from "@/hooks/useCreateListingForm";
import { useAppTheme } from "@/hooks/useAppTheme";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";
import { ListingLocationSection } from "@/components/products/ListingLocationSection";
import { ListingTextFields } from "@/components/products/ListingTextFields";
import { FormCategoryChip } from "@/components/filters/FormCategoryChip";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import { useCreateListingDraftGuardStore } from "@/lib/forms/createListingDraftGuardStore";
import { ImagePreviewModal } from "@/components/ui/ImagePreviewModal";
import { OfferSegmentedControl } from "./OfferSegmentedControl";
import { ScreenSafeView } from "@/components/layout/ScreenSafeView";

export default function CreateListingScreen() {
  const { theme, statusBarStyle } = useAppTheme();
  const params = useLocalSearchParams<{ returnToProductId?: string }>();
  const returnToProductId = typeof params.returnToProductId === "string" ? params.returnToProductId : undefined;
  const navigation = useNavigation();
  const categoriesQuery = useCategoriesQuery();
  const form = useCreateListingForm({ returnToProductId });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Two-step state
  const [step, setStep] = useState<1 | 2>(1);

  // ── Local field error state ───────────────────────────────────────────────
  // We manage errors locally so we can clear them precisely on each field
  // change, rather than waiting for the form hook to decide when to clear them.

  const [step1Errors, setStep1Errors] = useState<{
    title?: string;
    description?: string;
    locationName?: string;
  }>({});

  // Step-2 errors mirror form.state.fieldErrors but are cleared on change.
  // minMoneyAmount is the only user-editable validated field on step 2;
  // images error is cleared when images are added/removed.
  const [step2Errors, setStep2Errors] = useState<{
    minMoneyAmount?: string;
    images?: string;
  }>({});

  const categories = categoriesQuery.data ?? [];
  const hasAttachedLocation = form.state.manualLatitude != null && form.state.manualLongitude != null;
  const previewImages = form.state.images.map((asset) => ({ id: asset.uri, url: asset.uri }));

  // Block publish while any local errors remain unresolved.
  const hasUnresolvedErrors =
    step1Errors.title !== undefined ||
    step1Errors.description !== undefined ||
    step1Errors.locationName !== undefined ||
    step2Errors.minMoneyAmount !== undefined ||
    step2Errors.images !== undefined;

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Scroll back to top.
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      // Reset step and all local error state whenever the screen comes into
      // focus — covers re-visiting the tab after a submit or navigation event.
      setStep(1);
      setStep1Errors({});
      setStep2Errors({});
    });

    return unsubscribe;
  }, [navigation]);

  const hasUnsavedChanges =
    form.state.title.trim().length > 0 ||
    form.state.description.trim().length > 0 ||
    form.state.locationName.trim().length > 0 ||
    form.state.manualLatitude != null ||
    form.state.manualLongitude != null ||
    form.state.categoryId.length > 0 ||
    form.state.isFree ||
    !form.state.requestByMoney ||
    form.state.minMoneyAmount.trim().length > 0 ||
    form.state.images.length > 0;

  const switchTrackOffColor = theme.mode === "light" ? "#64748b" : "#475569";
  const switchTrackColor = {
    false: switchTrackOffColor,
    true: theme.colors.success,
  };

  const getSwitchThumbColor = (enabled: boolean) =>
    enabled ? theme.colors.onSuccess : theme.colors.surface;

  const setHasUnsavedChanges = useCreateListingDraftGuardStore((state) => state.setHasUnsavedChanges);
  const setResetDraft = useCreateListingDraftGuardStore((state) => state.setResetDraft);

  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
    return () => { setHasUnsavedChanges(false); };
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => {
    setResetDraft(form.actions.resetDraft);
    return () => { setResetDraft(null); };
  }, [form.actions.resetDraft, setResetDraft]);

  useUnsavedChangesPrompt({
    enabled: hasUnsavedChanges && !form.state.isSubmitting,
    title: "Discard draft?",
    message: "You have unsaved listing details. Keep editing or discard them?",
    keepEditingLabel: "Keep editing",
    discardLabel: "Discard",
    onDiscard: form.actions.resetDraft,
  });

  // ── Step-1 clear-on-change wrappers ──────────────────────────────────────

  const handleTitleChange = (value: string) => {
    if (step1Errors.title !== undefined) {
      setStep1Errors((prev) => ({ ...prev, title: undefined }));
    }
    form.actions.setTitle(value);
  };

  const handleDescriptionChange = (value: string) => {
    if (step1Errors.description !== undefined) {
      setStep1Errors((prev) => ({ ...prev, description: undefined }));
    }
    form.actions.setDescription(value);
  };

  // Attaching a location resolves the error; removing it doesn't.
  const handleAttachCurrentLocation = () => {
    if (step1Errors.locationName !== undefined) {
      setStep1Errors((prev) => ({ ...prev, locationName: undefined }));
    }
    return form.actions.attachCurrentLocation();
  };

  const handleClearLocation = () => {
    form.actions.clearManualCoordinates();
  };

  // ── Step-2 clear-on-change wrappers ──────────────────────────────────────

  const handleMinMoneyAmountChange = (value: string) => {
    if (step2Errors.minMoneyAmount !== undefined) {
      setStep2Errors((prev) => ({ ...prev, minMoneyAmount: undefined }));
    }
    form.actions.setMinMoneyAmount(value);
  };

  const handlePickImages = async () => {
    if (step2Errors.images !== undefined) {
      setStep2Errors((prev) => ({ ...prev, images: undefined }));
    }
    return form.actions.pickImages();
  };

  const handleRemoveImageAt = (index: number) => {
    if (step2Errors.images !== undefined) {
      setStep2Errors((prev) => ({ ...prev, images: undefined }));
    }
    form.actions.removeImageAt(index);
    if (previewIndex === index) {
      setPreviewIndex(null);
    }
  };

  // Changing the offer mode (isFree / requestByMoney / allowTradeRequest)
  // resets the minMoneyAmount error since the field may no longer apply.
  const handleSetIsFree = (value: boolean) => {
    if (step2Errors.minMoneyAmount !== undefined) {
      setStep2Errors((prev) => ({ ...prev, minMoneyAmount: undefined }));
    }
    form.actions.setIsFree(value);
  };

  const handleOfferModeChange = (val: "cash" | "trade" | "both") => {
    if (step2Errors.minMoneyAmount !== undefined) {
      setStep2Errors((prev) => ({ ...prev, minMoneyAmount: undefined }));
    }
    form.actions.setRequestByMoney(val === "cash" || val === "both");
    form.actions.setAllowTradeRequest(val === "both" || val === "trade");
  };

  // ── Step navigation ───────────────────────────────────────────────────────

  const handleNext = () => {
    const result = validateCreateListingDraft({
      title: form.state.title,
      description: form.state.description,
      locationName: form.state.locationName,
      // Dummy so the images rule doesn't fire on step 1.
      imageFileNames: ["placeholder.jpg"],
      categoryId: form.state.categoryId,
      isFree: form.state.isFree,
      requestByMoney: form.state.requestByMoney,
      allowTradeRequest: form.state.allowTradeRequest,
      minMoneyAmount: form.state.minMoneyAmount
        ? parseFloat(form.state.minMoneyAmount)
        : null,
    });

    const errors: typeof step1Errors = {
      title: result.fieldErrors.title,
      description: result.fieldErrors.description,
      locationName: result.fieldErrors.locationName,
    };

    // validateCreateListingDraft doesn't require locationName, but we do.
    if (!hasAttachedLocation) {
      errors.locationName = "Please select a location for your listing";
    }

    const hasErrors =
      errors.title !== undefined ||
      errors.description !== undefined ||
      errors.locationName !== undefined;

    if (hasErrors) {
      setStep1Errors(errors);
      return;
    }

    setStep1Errors({});
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    setStep(2);
  };

  const handleBack = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    setStep(1);
  };

  const handlePublish = () => {
    if (hasUnresolvedErrors) return;
    void form.actions.submit();
  };

  // Sync form-level errors into local step-2 state after a failed submit,
  // and clear them when the form resets (fieldErrors goes back to undefined).
  useEffect(() => {
    setStep2Errors((prev) => ({
      ...prev,
      minMoneyAmount: form.state.fieldErrors.minMoneyAmount ?? undefined,
    }));
  }, [form.state.fieldErrors.minMoneyAmount]);

  useEffect(() => {
    setStep2Errors((prev) => ({
      ...prev,
      images: form.state.fieldErrors.images ?? undefined,
    }));
  }, [form.state.fieldErrors.images]);

  return (
    <ScreenSafeView>
      <StatusBar style={statusBarStyle} />
      <View style={styles.fixedTopContent}>
        <PageHeaderCard
          title="Create Listing"
          subtitle={
            step === 1
              ? "Share clear details so buyers can decide faster."
              : "Add pricing, category, and photos."
          }
        />
        {/* Step indicator row — back icon on left when on step 2, dots centered */}
        <View style={styles.stepIndicatorRow}>
          {step === 2 ? (
            <Pressable onPress={handleBack} hitSlop={12} style={styles.stepBackIcon}>
              <Feather name="chevron-left" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.stepBackIcon} />
          )}
          <View style={styles.stepDots}>
            <View style={[styles.stepDot, { backgroundColor: theme.colors.primary }]} />
            <View
              style={[
                styles.stepConnector,
                { backgroundColor: step === 2 ? theme.colors.primary : theme.colors.border },
              ]}
            />
            <View
              style={[
                styles.stepDot,
                { backgroundColor: step === 2 ? theme.colors.primary : theme.colors.border },
              ]}
            />
          </View>
          {/* Spacer to keep dots visually centred */}
          <View style={styles.stepBackIcon} />
        </View>
      </View>

      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={16}
        contentContainerStyle={styles.content}
        scrollRef={scrollViewRef}
      >
        {/* ── STEP 1 ── */}
        {step === 1 && (
          <>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ListingTextFields
                title={form.state.title}
                description={form.state.description}
                titleError={step1Errors.title ?? null}
                descriptionError={step1Errors.description ?? null}
                onTitleChange={handleTitleChange}
                onDescriptionChange={handleDescriptionChange}
              />

              <ListingLocationSection
                locationName={form.state.locationName}
                locationWarning={form.state.locationWarning}
                fieldError={step1Errors.locationName ?? null}
                hasAttachedLocation={hasAttachedLocation}
                isLocating={form.state.isLocating}
                onAttachCurrentLocation={handleAttachCurrentLocation}
                onClearLocation={handleClearLocation}
              />
            </View>

            <View style={styles.actions}>
              <Button label="Next" onPress={handleNext} />
              <Button label="Cancel" variant="ghost" onPress={form.actions.cancel} />
            </View>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.categoryBlock}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <FormCategoryChip
                    label="None"
                    active={form.state.categoryId === ""}
                    onPress={() => form.actions.setCategoryId("")}
                  />
                  {categories.map((category) => (
                    <FormCategoryChip
                      key={category.id}
                      label={category.name}
                      active={form.state.categoryId === category.id}
                      onPress={() => form.actions.setCategoryId(category.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={[styles.switchBlock, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: theme.colors.textSecondary }]}>Mark as free</Text>
                <Switch
                  value={form.state.isFree}
                  onValueChange={handleSetIsFree}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(form.state.isFree)}
                  ios_backgroundColor={switchTrackOffColor}
                />
              </View>
              {!form.state.isFree ? (
                <OfferSegmentedControl
                  value={
                    form.state.isFree
                      ? "both"
                      : form.state.requestByMoney && form.state.allowTradeRequest
                      ? "both"
                      : form.state.requestByMoney
                      ? "cash"
                      : "trade"
                  }
                  onChange={handleOfferModeChange}
                  minMoneyAmount={form.state.minMoneyAmount}
                  onMinMoneyAmountChange={handleMinMoneyAmountChange}
                  minMoneyAmountError={step2Errors.minMoneyAmount ?? null}
                />
              ) : null}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.imageBlock}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  Product images (up to {form.rules.MAX_IMAGES})
                </Text>
                {form.state.images.length > 0 ? (
                  <>
                    <Text style={[styles.imageHint, { color: theme.colors.textMuted }]}>
                      {form.state.images.length} image(s) selected.
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imagePreviewList}
                    >
                      {form.state.images.map((asset, index) => (
                        <View
                          key={`${asset.uri}-${index}`}
                          style={[
                            styles.imagePreviewItem,
                            { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                          ]}
                        >
                          <Pressable
                            onPress={() => setPreviewIndex(index)}
                            style={styles.imagePreviewTouchArea}
                          >
                            <Image source={{ uri: asset.uri }} style={styles.imagePreviewThumb} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveImageAt(index)}
                            style={styles.removeImageButton}
                            hitSlop={8}
                          >
                            <Feather name="x" size={12} color="#F8FAFC" />
                          </Pressable>
                        </View>
                      ))}
                      {form.state.images.length < form.rules.MAX_IMAGES ? (
                        <Pressable
                          onPress={() => void handlePickImages()}
                          style={[
                            styles.imageAddButton,
                            { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                          ]}
                          hitSlop={8}
                        >
                          <Feather name="plus" size={20} color={theme.colors.textSecondary} />
                        </Pressable>
                      ) : null}
                    </ScrollView>
                    <Text style={[styles.imagePreviewHint, { color: theme.colors.textMuted }]}>
                      Tap an image to preview. Tap x to remove.
                    </Text>
                  </>
                ) : (
                  <Pressable
                    onPress={() => void handlePickImages()}
                    style={[
                      styles.emptyImagesCard,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                    ]}
                    hitSlop={8}
                  >
                    <Text style={{ color: theme.colors.textSecondary, fontWeight: "500" }}>Tap to add Images</Text>
                  </Pressable>
                )}
                {step2Errors.images ? (
                  <Text style={styles.errorText}>{step2Errors.images}</Text>
                ) : null}
              </View>
            </View>

            {form.state.formError ? <Text style={styles.errorText}>{form.state.formError}</Text> : null}

            <ImagePreviewModal
              images={previewImages}
              initialIndex={previewIndex ?? 0}
              visible={previewIndex !== null}
              onClose={() => setPreviewIndex(null)}
            />

            <View style={styles.actions}>
              <Button
                label="Publish listing"
                onPress={handlePublish}
                loading={form.state.isSubmitting}
                disabled={hasUnresolvedErrors}
              />
              <Button label="Cancel" variant="ghost" onPress={form.actions.cancel} />
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </ScreenSafeView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fixedTopContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  stepBackIcon: {
    width: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  stepDots: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepConnector: {
    width: 32,
    height: 2,
    borderRadius: 1,
  },
  keyboardWrap: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 110, gap: 12 },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  label: { fontSize: 13, fontWeight: "600" },
  categoryBlock: { gap: 6 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  switchBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { fontSize: 14, fontWeight: "500" },

  actions: { gap: 10, marginTop: 6 },
  errorText: { fontSize: 13, color: "#dc2626" },
  imageBlock: { gap: 6 },
  imageHint: { fontSize: 12 },
  imagePreviewList: { gap: 10, paddingVertical: 6 },
  imagePreviewItem: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  imagePreviewTouchArea: {
    flex: 1,
  },
  imagePreviewThumb: {
    width: "100%",
    height: "100%",
  },
  imageAddButton: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(248, 250, 252, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewHint: { fontSize: 12 },
  emptyImagesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
});