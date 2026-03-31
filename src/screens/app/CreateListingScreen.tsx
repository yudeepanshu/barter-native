import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Create Listing</Text>
          <Text style={styles.subtitle}>Share clear details so buyers can decide faster.</Text>
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

          <View style={styles.locationModeBlock}>
            <Text style={styles.label}>Location</Text>

            {form.state.locationName ? (
              <Text style={styles.locationHintStrong}>{form.state.locationName}</Text>
            ) : null}

            {/* Auto picker is temporarily disabled until location flow is stabilized. */}
            <Text style={styles.locationHint}>Auto picker is temporarily disabled.</Text>

            <Button
              label={hasManualPick ? "Update manual location" : "Search location by address"}
              variant="ghost"
              onPress={onOpenAddressSearch}
            />
          </View>
        </View>

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

        <View style={styles.sectionCard}>
          <View style={styles.imageBlock}>
            <Text style={styles.label}>Product images (up to {form.rules.MAX_IMAGES})</Text>
            <Button
              label="Choose images"
              variant="ghost"
              onPress={() => void form.actions.pickImages()}
            />
            {form.state.images.length > 0 ? (
              <Text style={styles.imageHint}>{form.state.images.length} image(s) selected.</Text>
            ) : (
              <Text style={styles.imageHint}>JPEG, PNG, or WebP only.</Text>
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

      <Modal
        visible={showAddressSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressSearch(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set location manually</Text>
            <Text style={styles.modalHint}>
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
  headerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 4,
  },
  subtitle: { fontSize: 13, color: "#64748b" },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
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
    borderColor: "#dbe3ed",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { color: "#334155", fontSize: 14, fontWeight: "500" },
  locationModeBlock: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#dbe3ed",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  locationModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  locationHint: { fontSize: 12, color: "#64748b" },
  locationHintStrong: { fontSize: 12, color: "#0f172a", fontWeight: "600" },
  actions: { gap: 10, marginTop: 6 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  imageBlock: { gap: 6 },
  imageHint: { fontSize: 12, color: "#64748b" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
    gap: 10,
    maxHeight: "86%",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalHint: { fontSize: 13, color: "#64748b" },
  modalActions: { flexDirection: "row", gap: 8 },
  modalActionCell: { flex: 1 },
});
