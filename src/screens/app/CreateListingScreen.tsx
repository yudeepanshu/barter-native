import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
import { useSession } from "@/hooks/useSession";
import { useAppDialog } from "@/providers/AppDialogProvider";
import {
  hasReachedProductCreationLimit,
  getProductCreationLimitMessage,
  MAX_PRODUCTS_PER_USER,
} from "@/lib/listings/productCreationLimit";
import { queryClient } from "@/lib/query/queryClient";
import { queryKeys } from "@/lib/query/queryKeys";
import type { InfiniteData } from "@tanstack/react-query";
import type { ProductsListResult } from "@barter/types";

export default function CreateListingScreen() {
  const { theme, statusBarStyle } = useAppTheme();
  const router = useRouter();
  const session = useSession();
  const dialog = useAppDialog();
  const params = useLocalSearchParams<{ returnToProductId?: string }>();
  const returnToProductId = typeof params.returnToProductId === "string" ? params.returnToProductId : undefined;
  const categoriesQuery = useCategoriesQuery();
  const form = useCreateListingForm({ returnToProductId });
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const categories = categoriesQuery.data ?? [];
  const hasAttachedLocation = form.state.manualLatitude != null && form.state.manualLongitude != null;
  const hasUnsavedChanges =
    form.state.title.trim().length > 0 ||
    form.state.description.trim().length > 0 ||
    form.state.locationName.trim().length > 0 ||
    form.state.manualLatitude != null ||
    form.state.manualLongitude != null ||
    form.state.categoryId.length > 0 ||
    form.state.isFree ||
    form.state.requestByMoney ||
    form.state.minMoneyAmount.trim().length > 0 ||
    form.state.images.length > 0;
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

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    void (async () => {
      // Check the query cache first — populated by UserListingsBootstrap at login.
      const cached = queryClient.getQueryData<InfiniteData<ProductsListResult>>(
        queryKeys.products.infinite({ ownerId: userId, limit: 40 }),
      );

      let atLimit: boolean;
      if (cached) {
        const allItems = cached.pages.flatMap((p) => p.items);
        atLimit = allItems.filter((p) => p.status !== "REMOVED").length >= MAX_PRODUCTS_PER_USER;
      } else {
        atLimit = await hasReachedProductCreationLimit(userId);
      }

      if (!atLimit) return;

      const action = await dialog.show({
        title: "Limit reached",
        message: getProductCreationLimitMessage(MAX_PRODUCTS_PER_USER),
        actions: [{ key: "see-listings", label: "See current listings" }],
        dismissOnBackdrop: true,
      });

      if (action === "see-listings") {
        router.replace("/(app)/(tabs)/my-listings");
      } else {
        router.back();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          <View style={[styles.switchBlock, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.colors.textSecondary }]}>Mark as free</Text>
              <Switch value={form.state.isFree} onValueChange={form.actions.setIsFree} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.colors.textSecondary }]}>Open to money offers</Text>
              <Switch
                value={form.state.requestByMoney}
                onValueChange={form.actions.setRequestByMoney}
              />
            </View>
            {form.state.requestByMoney ? (
              <Input
                label="Minimum amount (₹)"
                value={form.state.minMoneyAmount}
                onChangeText={form.actions.setMinMoneyAmount}
                keyboardType="numeric"
                placeholder="Enter minimum accepted amount"
                error={form.state.fieldErrors.minMoneyAmount ?? null}
              />
            ) : null}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.imageBlock}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Product images (up to {form.rules.MAX_IMAGES})</Text>
            <Button
              label="Choose images"
              variant="ghost"
              onPress={() => void form.actions.pickImages()}
            />
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
                        onPress={() => setPreviewImageUri(asset.uri)}
                        style={styles.imagePreviewTouchArea}
                      >
                        <Image source={{ uri: asset.uri }} style={styles.imagePreviewThumb} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          form.actions.removeImageAt(index);
                          if (previewImageUri === asset.uri) {
                            setPreviewImageUri(null);
                          }
                        }}
                        style={styles.removeImageButton}
                        hitSlop={8}
                      >
                        <Feather name="x" size={12} color="#F8FAFC" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Text style={[styles.imagePreviewHint, { color: theme.colors.textMuted }]}>Tap an image to preview. Tap x to remove.</Text>
              </>
            ) : (
              <View style={[styles.emptyImagesCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                <Feather name="image" size={16} color={theme.colors.textMuted} />
                <Text style={[styles.imageHint, { color: theme.colors.textMuted }]}>Add 1 or more images before publishing.</Text>
              </View>
            )}
            {form.state.fieldErrors.images ? (
              <Text style={styles.errorText}>{form.state.fieldErrors.images}</Text>
            ) : null}
          </View>
        </View>

        {form.state.formError ? <Text style={styles.errorText}>{form.state.formError}</Text> : null}

        <View style={styles.actions}>
          <Button
            label="Publish listing"
            onPress={() => void form.actions.submit()}
            loading={form.state.isSubmitting}
          />
          <Button label="Cancel" variant="ghost" onPress={form.actions.cancel} />
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={Boolean(previewImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <Pressable
          style={[styles.previewBackdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setPreviewImageUri(null)}
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
            {previewImageUri ? <Image source={{ uri: previewImageUri }} style={styles.previewImage} /> : null}
            <Button label="Close" variant="ghost" onPress={() => setPreviewImageUri(null)} />
          </View>
        </Pressable>
      </Modal>
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
  previewBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  previewCard: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
});
