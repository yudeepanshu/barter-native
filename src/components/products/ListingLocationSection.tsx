import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ListingLocationSectionProps {
  locationName: string;
  locationWarning?: string | null;
  fieldError?: string | null;
  hasAttachedLocation: boolean;
  isLocating: boolean;
  onAttachCurrentLocation: () => void | Promise<boolean>;
  onClearLocation: () => void;
}

export function ListingLocationSection({
  locationName,
  locationWarning,
  fieldError,
  hasAttachedLocation,
  isLocating,
  onAttachCurrentLocation,
  onClearLocation,
}: ListingLocationSectionProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.locationModeBlock, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Location</Text>

      {locationName ? (
        <Text style={[styles.locationHintStrong, { color: theme.colors.textPrimary }]}>{locationName}</Text>
      ) : <Text style={[styles.locationHint, { color: theme.colors.textMuted }]}>Attach your current device location to this listing.</Text>}

      {locationWarning ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{locationWarning}</Text> : null}
      {fieldError ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{fieldError}</Text> : null}

      {hasAttachedLocation ? (
        <View style={styles.locationModeRow}>
          <View style={styles.locationActionCell}>
            <Button
              label="Refresh"
              variant="ghost"
              loading={isLocating}
              onPress={() => void onAttachCurrentLocation()}
            />
          </View>
          <View style={styles.locationActionCell}>
            <Button
              label="Remove"
              variant="ghost"
              onPress={onClearLocation}
              disabled={isLocating}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Select location"
          variant="ghost"
          loading={isLocating}
          onPress={() => void onAttachCurrentLocation()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600" },
  locationModeBlock: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  locationModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  locationActionCell: { flex: 1, minWidth: 140 },
  locationHint: { fontSize: 12 },
  locationHintStrong: { fontSize: 12, fontWeight: "600" },
  errorText: { fontSize: 13 },
});