import { Pressable, ScrollView, StyleSheet, Switch, Text, View, Alert, Image } from "react-native";
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
        <View style={styles.errorCard}>
          <Text style={styles.title}>Listing not found</Text>
          <Text style={styles.description}>We could not load this listing.</Text>
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
        <View style={styles.errorCard}>
          <Text style={styles.title}>Not allowed</Text>
          <Text style={styles.description}>You can only edit your own listings.</Text>
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Edit Listing</Text>
          <Text style={styles.subtitle}>Update your listing details.</Text>
        </View>

        <View style={styles.sectionCard}>
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
          <View style={styles.sectionCard}>
            <View style={styles.imageBlock}>
              <Text style={styles.label}>Images</Text>
              <View style={styles.imagesGrid}>
                {product.productImages.map((image) => (
                  <View key={image.id} style={styles.imageCard}>
                    <Image source={{ uri: image.url }} style={styles.productImage} />
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

        <View style={styles.sectionCard}>
          <View style={styles.categoryBlock}>
            <Text style={styles.label}>Category</Text>
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

          <View style={styles.switchBlock}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Mark as free</Text>
              <Switch value={form.state.isFree} onValueChange={form.actions.setIsFree} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Open to money offers</Text>
              <Switch
                value={form.state.requestByMoney}
                onValueChange={form.actions.setRequestByMoney}
                disabled={form.state.isFree}
              />
            </View>
          </View>
        </View>

        {form.state.formError ? <Text style={styles.errorText}>{form.state.formError}</Text> : null}

        <View style={styles.actionsCol}>
          <Button
            label="Save changes"
            onPress={() => void form.actions.submit()}
            loading={form.state.isSubmitting}
          />
          <Button label="Cancel" variant="ghost" onPress={form.actions.cancel} />
        </View>
      </ScrollView>
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
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.chip, active ? styles.chipActive : undefined]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorCard: {
    margin: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 4,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b" },
  description: { fontSize: 14, color: "#475569" },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#334155" },
  categoryBlock: { gap: 6 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
    color: "#ffffff",
  },
  switchBlock: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { color: "#334155", fontSize: 14, fontWeight: "500" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  actionsCol: { gap: 10, marginTop: 4 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  imageBlock: { gap: 8 },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageCard: { position: "relative", width: "32%" },
  productImage: { width: "100%", height: 120, borderRadius: 8, backgroundColor: "#e2e8f0" },
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
