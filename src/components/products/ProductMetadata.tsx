import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ProductSummary } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";

type ProductMetadataVariant = "detail" | "compact";

interface ProductMetadataProps {
  product: ProductSummary;
  variant?: ProductMetadataVariant;
  showCategory?: boolean;
  showProductType?: boolean;
  showLocation?: boolean;
  locationLines?: number;
}

export function getProductTypeLabel(product: ProductSummary) {
  if (product.isFree) return "Free";
  if (product.requestByMoney) return "Open to money offers";
  return "Barter only";
}

const INACTIVE_EXPIRY_DAYS = 7;

/**
 * Returns a human-readable warning string when a product is INACTIVE and
 * approaching automatic removal, or null if not applicable.
 * Expiry is computed from updatedAt + INACTIVE_EXPIRY_DAYS (matches backend default).
 */
export function getInactiveExpiryWarning(product: ProductSummary): string | null {
  if (product.status !== "INACTIVE") return null;
  const updatedAt = new Date(product.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return null;
  const expiresAt = updatedAt + INACTIVE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) {
    return "This listing is pending removal and will no longer be available soon.";
  }
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft === 1) {
    return "This listing will be permanently removed in less than 1 day. Relist it now to keep it.";
  }
  return `This listing will be permanently removed in ${daysLeft} days. Relist it to keep it.`;
}

function getCategoryLabel(product: ProductSummary) {
  const value = (product.category?.name ?? "Uncategorized").trim();
  return value.length > 0 ? value : "Uncategorized";
}

function getLocationLabel(product: ProductSummary) {
  const value = (product.locationName ?? "").trim().replace(/\s+/g, " ");
  return value.length > 0 ? value : null;
}

export function hasExchangeHistory(product: ProductSummary) {
  return product.isPreOwned && product.exchangeCount > 0;
}

export function ProductMetadata({
  product,
  variant = "detail",
  showCategory,
  showProductType = true,
  showLocation,
  locationLines = 2,
}: ProductMetadataProps) {
  const { theme } = useAppTheme();
  const includeCategory = showCategory ?? variant === "detail";
  const includeLocation = showLocation ?? variant === "detail";
  const location = getLocationLabel(product);

  const chips: Array<{
    key: string;
    icon: "tag" | "package" | "map-pin";
    value: string;
    chipStyle: object;
    textStyle: object;
    lines?: number;
  }> = [];

  if (showProductType) {
    chips.push({
      key: "type",
      icon: "package",
      value: getProductTypeLabel(product),
      chipStyle: product.isFree
        ? styles.metaChipFree
        : product.requestByMoney
          ? styles.metaChipMoney
          : styles.metaChipBarter,
      textStyle: product.isFree
        ? styles.metaChipTextFree
        : product.requestByMoney
          ? styles.metaChipTextMoney
          : styles.metaChipTextBarter,
    });
  }

  if (includeCategory) {
    chips.push({
      key: "category",
      icon: "tag",
      value: getCategoryLabel(product),
      chipStyle: styles.metaChipCategory,
      textStyle: styles.metaChipTextCategory,
    });
  }

  if (includeLocation && location) {
    chips.push({
      key: "location",
      icon: "map-pin",
      value: location,
      chipStyle: styles.metaChipLocation,
      textStyle: styles.metaChipTextLocation,
      lines: locationLines,
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, variant === "compact" && styles.containerCompact]}>
      {chips.map((chip) => (
        <View key={chip.key} style={[styles.metaChip, chip.chipStyle]}>
          <Feather name={chip.icon} size={12} color={theme.colors.textMuted} style={styles.metaChipIcon} />
          <Text
            numberOfLines={chip.lines ?? 1}
            style={[styles.metaChipText, chip.textStyle]}
          >
            {chip.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  containerCompact: {
    marginTop: 2,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  metaChipIcon: { marginTop: 0.5 },
  metaChipText: {
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 230,
  },
  metaChipCategory: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  metaChipTextCategory: { color: "#475569" },
  metaChipFree: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  metaChipTextFree: { color: "#166534" },
  metaChipMoney: { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  metaChipTextMoney: { color: "#92400e" },
  metaChipBarter: { backgroundColor: "#ede9fe", borderColor: "#c4b5fd" },
  metaChipTextBarter: { color: "#4c1d95" },
  metaChipLocation: { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" },
  metaChipTextLocation: { color: "#0c4a6e" },
});
