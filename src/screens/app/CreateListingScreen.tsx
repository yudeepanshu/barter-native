import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useCreateListingForm } from "@/hooks/useCreateListingForm";
import { ensureGeocodingPermission } from "@/hooks/useDeviceLocation";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function CreateListingScreen() {
  const { theme, statusBarStyle } = useAppTheme();
  const categoriesQuery = useCategoriesQuery();
  const form = useCreateListingForm();
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);

  const categories = categoriesQuery.data ?? [];
  const hasManualPick = form.state.manualLatitude != null && form.state.manualLongitude != null;

  const onOpenAddressSearch = () => {
    setAddressSearchError(null);
    setShowAddressSearch(true);
  };

  const onSearchAddress = async () => {
    const q = addressQuery.trim();
    if (!q) return;
    setIsSearchingAddress(true);
    setAddressSearchError(null);
    try {
      const canGeocode = await ensureGeocodingPermission();
      if (!canGeocode) {
        setAddressSearchError("Location permission is required to search addresses on Android.");
        return;
      }

      const results = await Location.geocodeAsync(q);
      if (results.length === 0) {
        setAddressSearchError("No location found. Try a more specific address.");
        return;
      }
      const { latitude, longitude } = results[0];
      // setManualCoordinates also reverse-geocodes and fills locationName
      void form.actions.setManualCoordinates(latitude, longitude);
      setShowAddressSearch(false);
      setAddressQuery("");
    } catch (error) {
      setAddressSearchError(
        error instanceof Error && error.message
          ? error.message
          : "Search failed. Check your internet connection.",
      );
    } finally {
      setIsSearchingAddress(false);
    }
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
        <View style={styles.headerCard}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Create Listing</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Share clear details so buyers can decide faster.</Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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

          <View style={[styles.locationModeBlock, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Location</Text>

            {form.state.locationName ? (
              <Text style={[styles.locationHintStrong, { color: theme.colors.textPrimary }]}>{form.state.locationName}</Text>
            ) : null}

            {/* Auto picker is temporarily disabled until location flow is stabilized. */}
            <Text style={[styles.locationHint, { color: theme.colors.textMuted }]}>Auto picker is temporarily disabled.</Text>

            <Button
              label={hasManualPick ? "Update manual location" : "Search location by address"}
              variant="ghost"
              onPress={onOpenAddressSearch}
            />
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                        style={[styles.removeImageButton, { backgroundColor: theme.colors.overlay }]}
                        hitSlop={8}
                      >
                        <Feather name="x" size={12} color={theme.colors.onPrimary} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Text style={[styles.imagePreviewHint, { color: theme.colors.textMuted }]}>Tap an image to preview. Tap x to remove.</Text>
              </>
            ) : (
              <Text style={[styles.imageHint, { color: theme.colors.textMuted }]}>JPEG, PNG, or WebP only.</Text>
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
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showAddressSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressSearch(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Set location manually</Text>
            <Text style={[styles.modalHint, { color: theme.colors.textMuted }]}>
              Type a city, area, or full address. We\'ll look up its coordinates automatically.
            </Text>

            <Input
              label=""
              placeholder="e.g., Sector 21, Noida"
              value={addressQuery}
              onChangeText={setAddressQuery}
            />

            {addressSearchError ? (
              <Text style={styles.errorText}>{addressSearchError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <View style={styles.modalActionCell}>
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setShowAddressSearch(false);
                    setAddressQuery("");
                    setAddressSearchError(null);
                  }}
                />
              </View>
              <View style={styles.modalActionCell}>
                <Button
                  label="Find location"
                  loading={isSearchingAddress}
                  onPress={() => void onSearchAddress()}
                  disabled={!addressQuery.trim()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  subtitle: { fontSize: 13 },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: "800" },
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
  locationModeBlock: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  locationModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  locationHint: { fontSize: 12 },
  locationHintStrong: { fontSize: 12, fontWeight: "600" },
  actions: { gap: 10, marginTop: 6 },
  errorText: { fontSize: 13 },
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
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewHint: { fontSize: 12 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
    gap: 10,
    maxHeight: "86%",
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalHint: { fontSize: 13 },
  modalActions: { flexDirection: "row", gap: 8 },
  modalActionCell: { flex: 1 },
});
