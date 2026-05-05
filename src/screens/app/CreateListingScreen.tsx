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
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function CreateListingScreen() {
  const { theme, statusBarStyle } = useAppTheme();
  const params = useLocalSearchParams<{ returnToProductId?: string }>();
  const returnToProductId = typeof params.returnToProductId === "string" ? params.returnToProductId : undefined;
  const navigation = useNavigation();
  const categoriesQuery = useCategoriesQuery();
  const form = useCreateListingForm({ returnToProductId });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const categories = categoriesQuery.data ?? [];
  const hasAttachedLocation = form.state.manualLatitude != null && form.state.manualLongitude != null;
  const previewImages = form.state.images.map((asset) => ({ id: asset.uri, url: asset.uri }));

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
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

    return () => {
      setHasUnsavedChanges(false);
    };
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => {
    setResetDraft(form.actions.resetDraft);

    return () => {
      setResetDraft(null);
    };
  }, [form.actions.resetDraft, setResetDraft]);

  useUnsavedChangesPrompt({
    enabled: hasUnsavedChanges && !form.state.isSubmitting,
    title: "Discard draft?",
    message: "You have unsaved listing details. Keep editing or discard them?",
    keepEditingLabel: "Keep editing",
    discardLabel: "Discard",
    onDiscard: form.actions.resetDraft,
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.fixedTopContent}>
        <PageHeaderCard
          title="Create Listing"
          subtitle="Share clear details so buyers can decide faster."
        />
      </View>
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={16}
        contentContainerStyle={styles.content}
        scrollRef={scrollViewRef}
      >
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ListingTextFields
            title={form.state.title}
            description={form.state.description}
            titleError={form.state.fieldErrors.title ?? null}
            descriptionError={form.state.fieldErrors.description ?? null}
            onTitleChange={form.actions.setTitle}
            onDescriptionChange={form.actions.setDescription}
          />

          <ListingLocationSection
            locationName={form.state.locationName}
            locationWarning={form.state.locationWarning}
            fieldError={form.state.fieldErrors.locationName ?? null}
            hasAttachedLocation={hasAttachedLocation}
            isLocating={form.state.isLocating}
            onAttachCurrentLocation={form.actions.attachCurrentLocation}
            onClearLocation={form.actions.clearManualCoordinates}
          />
        </View>

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
                onValueChange={form.actions.setIsFree}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(form.state.isFree)}
                ios_backgroundColor={switchTrackOffColor}
              />
            </View>
            {!form.state.isFree ? <OfferSegmentedControl
              value={
                form.state.isFree
                  ? "both"
                  : form.state.requestByMoney && form.state.allowTradeRequest
                  ? "both"
                  : form.state.requestByMoney
                  ? "cash"
                  : "trade"
              }
              onChange={(val) => {
                form.actions.setRequestByMoney(val === "cash" || val === "both");
                form.actions.setAllowTradeRequest(val === "both" || val === "trade");
              }}
              minMoneyAmount={form.state.minMoneyAmount}
              onMinMoneyAmountChange={form.actions.setMinMoneyAmount}
              minMoneyAmountError={form.state.fieldErrors.minMoneyAmount ?? null}
            /> : null}
          </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.imageBlock}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Product images (up to {form.rules.MAX_IMAGES})</Text>
            {form.state.images.length > 0 ? (
              <>
                <Text style={[styles.imageHint, { color: theme.colors.textMuted }]}>{form.state.images.length} image(s) selected.</Text>
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
                        onPress={() => {
                          form.actions.removeImageAt(index);
                          if (previewIndex === index) {
                            setPreviewIndex(null);
                          }
                        }}
                        style={styles.removeImageButton}
                        hitSlop={8}
                      >
                        <Feather name="x" size={12} color="#F8FAFC" />
                      </Pressable>
                    </View>
                  ))}
                  {form.state.images.length < form.rules.MAX_IMAGES ? (
                    <Pressable
                      onPress={() => void form.actions.pickImages()}
                      style={[styles.imageAddButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                      hitSlop={8}
                    >
                      <Feather name="plus" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </ScrollView>
                <Text style={[styles.imagePreviewHint, { color: theme.colors.textMuted }]}>Tap an image to preview. Tap x to remove.</Text>
              </>
            ) : (
              <Pressable
                onPress={() => void form.actions.pickImages()}
                style={[styles.emptyImagesCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                hitSlop={8}
              >
                <Text style={{ color: theme.colors.textSecondary }}>Tap to add Images.</Text>
              </Pressable>
            )}
            {form.state.fieldErrors.images ? (
              <Text style={styles.errorText}>{form.state.fieldErrors.images}</Text>
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
            onPress={() => void form.actions.submit()}
            loading={form.state.isSubmitting}
          />
          <Button label="Cancel" variant="ghost" onPress={form.actions.cancel} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fixedTopContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
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
