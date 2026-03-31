import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { Category, ProductSummary } from "@barter/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useProductQuery } from "@/hooks/queries/useProductQuery";
import { useEditListingForm } from "@/hooks/useEditListingForm";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  toErrorMessage as toImageErrorMessage,
  useDeleteProductImageMutation,
} from "@/hooks/mutations/useDeleteProductImageMutation";

export default function EditListingScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = typeof params.id === "string" ? params.id : "";

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
        <View style={[styles.errorCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Listing not found</Text>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>We could not load this listing.</Text>
          <View style={styles.actions}>
            <Button label="Retry" onPress={() => void productQuery.refetch()} />
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (productQuery.data.currentOwnerId !== session.user.id) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={[styles.errorCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Not allowed</Text>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>You can only edit your own listings.</Text>
          <View style={styles.actions}>
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const categories = categoriesQuery.data ?? [];

  return <EditListingFormSection product={productQuery.data} categories={categories} />;
}

function EditListingFormSection({
  product,
  categories,
}: {
  product: ProductSummary;
  categories: Category[];
}) {
  const { theme, statusBarStyle } = useAppTheme();
  const form = useEditListingForm(product);
  const deleteImageMutation = useDeleteProductImageMutation(product.id);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  if (!form.state.hasInitialized) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Spinner size={30} />
        </View>
      </SafeAreaView>
    );
  }

  const onDeleteImage = (imageId: string) => {
    Alert.alert("Delete image", "Delete this image? This action cannot be undone.", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setDeletingImageId(imageId);
          deleteImageMutation
            .mutateAsync(imageId)
            .catch((error) => {
              Alert.alert("Delete failed", toImageErrorMessage(error));
            })
            .finally(() => {
              setDeletingImageId(null);
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        <View style={[styles.headerCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Edit Listing</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Update your listing details.</Text>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Input
            label="Title"
            placeholder="e.g., Mountain bike in good condition"
            value={form.state.title}
            onChangeText={form.actions.setTitle}
            error={form.state.fieldErrors.title ?? null}
          />

          <Input
            label="Description"
            placeholder="Add details about condition, usage, and expectations."
            value={form.state.description}
            onChangeText={form.actions.setDescription}
            error={form.state.fieldErrors.description ?? null}
          />

          <Input
            label="Location"
            placeholder="e.g., Sector 21, Noida"
            value={form.state.locationName}
            onChangeText={form.actions.setLocationName}
            error={form.state.fieldErrors.locationName ?? null}
          />
        </View>

        {product.productImages.length > 0 ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <View style={styles.imageBlock}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Images</Text>
              <View style={styles.imagesGrid}>
                {product.productImages.map((image) => (
                  <View key={image.id} style={styles.imageCard}>
                    <Image source={{ uri: image.url }} style={[styles.productImage, { backgroundColor: theme.colors.surfaceMuted }]} />
                    {image.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => onDeleteImage(image.id)}
                      disabled={deletingImageId === image.id}
                      style={[
                        styles.deleteImageButton,
                        deletingImageId === image.id && styles.deleteImageButtonDisabled,
                      ]}
                    >
                      <Text style={styles.deleteImageButtonText}>
                        {deletingImageId === image.id ? "Deleting..." : "Delete"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.categoryBlock}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <CategoryChip
                label="None"
                active={form.state.categoryId === ""}
                onPress={() => form.actions.setCategoryId("")}
              />
              {categories.map((category) => (
                <CategoryChip
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
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable onPress={onPress}>
      <Text
        style={[
          styles.chip,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.textSecondary,
          },
          active
            ? {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.primary,
                color: theme.colors.onPrimary,
              }
            : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardWrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorCard: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 13 },
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
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: "600",
    fontSize: 12,
  },
  chipActive: {},
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
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageCard: { position: "relative", width: "32%" },
  productImage: { width: "100%", height: 120, borderRadius: 8 },
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
  deleteImageButton: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteImageButtonDisabled: { opacity: 0.5 },
  deleteImageButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
});
