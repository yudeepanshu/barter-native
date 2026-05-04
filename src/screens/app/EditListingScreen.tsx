import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Image,
} from "react-native";
import { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Category, ProductSummary } from "@barter/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useProductQuery } from "@/hooks/queries/useProductQuery";
import { useEditListingForm } from "@/hooks/useEditListingForm";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";
import { ListingLocationSection } from "@/components/products/ListingLocationSection";
import { ListingTextFields } from "@/components/products/ListingTextFields";
import { FormCategoryChip } from "@/components/filters/FormCategoryChip";
import { ImagePreviewModal } from "@/components/ui/ImagePreviewModal";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { ErrorView } from "@/components/ui/ErrorView";
import { OfferSegmentedControl } from "./OfferSegmentedControl";

export default function EditListingScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const productId = typeof params.id === "string" ? params.id : "";
  const returnTo = params.returnTo === "my-listings" ? "my-listings" : undefined;

  const session = useSession();
  const categoriesQuery = useCategoriesQuery();
  const productQuery = useProductQuery(productId);

  if (!session) {
    return null;
  }

  if (productQuery.isPending) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Spinner size={30} />
        </View>
      </SafeAreaView>
    );
  }

  if (productQuery.error || !productQuery.data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <ErrorView
          title='Listing not found'
          message='We could not load this listing.'
          buttons={[
            {
              label: 'Retry',
              onPress: () => void productQuery.refetch(),
            },
            {
              label: 'Back',
              variant: 'ghost',
              onPress: () => router.back(),
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  if (productQuery.data.currentOwnerId !== session.user.id) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <ErrorView
          title='Not allowed'
          message='You can only edit your own listings.'
          buttons={[
            {
              label: 'Back',
              variant: 'ghost',
              onPress: () => router.back(),
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  const categories = categoriesQuery.data ?? [];

  return <EditListingFormSection product={productQuery.data} categories={categories} returnTo={returnTo} />;
}

function EditListingFormSection({
  product,
  categories,
  returnTo,
}: {
  product: ProductSummary;
  categories: Category[];
  returnTo?: "my-listings";
}) {
  const { theme, statusBarStyle } = useAppTheme();
  const form = useEditListingForm(product, { returnTo });
  const dialog = useAppDialog();
  const hasAttachedLocation = form.state.manualLatitude != null && form.state.manualLongitude != null;
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewImages = [
    ...form.state.existingImages.map((image) => ({ id: image.id, url: image.url })),
    ...form.state.newImages.map((asset) => ({ id: asset.uri, url: asset.uri })),
  ];

  const switchTrackOffColor = theme.mode === "light" ? "#64748b" : "#475569";
  const switchTrackColor = {
    false: switchTrackOffColor,
    true: theme.colors.success,
  };

  const getSwitchThumbColor = (enabled: boolean) =>
    enabled ? theme.colors.onSuccess : theme.colors.surface;

  if (!form.state.hasInitialized) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Spinner size={30} />
        </View>
      </SafeAreaView>
    );
  }

  const onRemoveExistingImage = (imageId: string) => {
    void (async () => {
      const shouldRemove = await dialog.confirm(
        "Remove image",
        "Remove this image from the listing draft?",
        {
          confirmLabel: "Remove",
          cancelLabel: "Cancel",
          destructive: true,
        },
      );

      if (shouldRemove) {
        form.actions.removeExistingImage(imageId);
      }
    })();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.fixedTopContent}>
        <PageHeaderCard
          title="Edit Listing"
          subtitle="Update your listing details."
        />
      </View>
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={16}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
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

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.imageBlock}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Images (up to {form.rules.MAX_IMAGES})</Text>

            {form.state.existingImages.length + form.state.newImages.length > 0 ? (
              <>
                <Text style={[styles.imageHint, { color: theme.colors.textMuted }]}> 
                  {form.state.existingImages.length + form.state.newImages.length} image(s).
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imagesRow}
                >
                  {form.state.existingImages.map((image) => (
                    <View key={image.id} style={styles.imageCard}>
                      <Pressable onPress={() => setPreviewIndex(form.state.existingImages.findIndex((item) => item.id === image.id))}>
                        <Image source={{ uri: image.url }} style={[styles.productImage, { backgroundColor: theme.colors.surfaceMuted }]} />
                      </Pressable>
                      {image.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                      <Pressable onPress={() => onRemoveExistingImage(image.id)} style={styles.deleteImageButton}>
                        <Text style={styles.deleteImageButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}

                  {form.state.newImages.map((asset, index) => (
                    <View key={`${asset.uri}-${index}`} style={styles.imageCard}>
                      <Pressable onPress={() => setPreviewIndex(form.state.existingImages.length + index)}>
                        <Image source={{ uri: asset.uri }} style={[styles.productImage, { backgroundColor: theme.colors.surfaceMuted }]} />
                      </Pressable>
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                      <Pressable onPress={() => form.actions.removeNewImageAt(index)} style={styles.deleteImageButton}>
                        <Text style={styles.deleteImageButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}

                  {form.state.existingImages.length + form.state.newImages.length < form.rules.MAX_IMAGES ? (
                    <Pressable
                      onPress={() => void form.actions.pickImages()}
                      style={[styles.imageAddCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                      hitSlop={8}
                    >
                      <Feather name="plus" size={24} color={theme.colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </ScrollView>
                <Text style={[styles.imageHint, { color: theme.colors.textMuted }]}>Changes apply only after you save.</Text>
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
              <Text style={[styles.errorText, { color: theme.colors.danger }]}>{form.state.fieldErrors.images}</Text>
            ) : null}
          </View>
        </View>

        <ImagePreviewModal
          images={previewImages}
          initialIndex={previewIndex ?? 0}
          visible={previewIndex !== null}
          onClose={() => setPreviewIndex(null)}
        />

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
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
              <Switch
                value={form.state.isFree}
                onValueChange={form.actions.setIsFree}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(form.state.isFree)}
                ios_backgroundColor={switchTrackOffColor}
              />
            </View>
            {/* <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.colors.textSecondary }]}>Cash offers</Text>
              <Switch
                value={form.state.requestByMoney}
                onValueChange={form.actions.setRequestByMoney}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(form.state.requestByMoney)}
                ios_backgroundColor={switchTrackOffColor}
              />
            </View>
            {form.state.requestByMoney ? (
              <Input
                // label="Minimum amount (₹)"
                value={form.state.minMoneyAmount}
                onChangeText={form.actions.setMinMoneyAmount}
                keyboardType="numeric"
                placeholder="Enter minimum accepted amount (₹)"
                error={form.state.fieldErrors.minMoneyAmount ?? null}
              />
            ) : null} */}

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
        </View>

        {form.state.formError ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{form.state.formError}</Text> : null}

        <View style={styles.actionsCol}>
          <Button
            label="Save changes"
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorCard: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "800" },
  description: { fontSize: 14 },
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
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  actionsCol: { gap: 10, marginTop: 4 },
  errorText: { fontSize: 13 },
  imageBlock: { gap: 8 },
  imageHint: { fontSize: 12 },
  imagesRow: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  imageCard: { position: "relative", width: 120 },
  imageAddCard: {
    width: 120,
    height: 120,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: { width: "100%", height: 120, borderRadius: 8 },
  emptyImagesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  primaryBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  newBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  newBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  deleteImageButton: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteImageButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
});
