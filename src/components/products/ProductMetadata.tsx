import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ProductSummary } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";

type ProductMetadataVariant = "detail" | "compact";

const TRADE_TYPE_CHIP_COLORS = {
  light: {
    free: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
    money: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
    barter: { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
  },
  dark: {
    free: { bg: "#052e1a", border: "#22c55e", text: "#4ade80" },
    money: { bg: "#3b2400", border: "#f59e0b", text: "#fbbf24" },
    barter: { bg: "#2e1065", border: "#8b5cf6", text: "#a78bfa" },
  },
} as const;

interface ProductMetadataProps {
  product: ProductSummary;
  variant?: ProductMetadataVariant;
  showCategory?: boolean;
  showProductType?: boolean;
  showLocation?: boolean;
  viewerLocation?: { latitude: number; longitude: number } | null;
  fallbackDistanceLabel?: string | null;
  distanceOverrideLabel?: string | null;
  locationLines?: number;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function formatDistanceLabel(distanceKm: number) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return null;
  }
  if (distanceKm < 1) {
    return "Nearby";
  }
  if (distanceKm > 100) {
    return ">100 km away";
  }
  const kmText = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();
  return `${kmText} km away`;
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

export function formatLocationBadgeLabel(locationName?: string | null) {
  const value = (locationName ?? "").trim().replace(/\s+/g, " ");
  if (!value) {
    return null;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return parts.join(", ");
  }

  const country = parts[parts.length - 1]?.toLowerCase();
  if (country === "india") {
    return parts.slice(-3, -1).join(", ");
  }

  return parts.slice(-3).join(", ");
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
  viewerLocation,
  fallbackDistanceLabel = null,
  distanceOverrideLabel = null,
  locationLines = 2,
}: ProductMetadataProps) {
  const { theme } = useAppTheme();
  const tradeTypeColors = theme.mode === "dark" ? TRADE_TYPE_CHIP_COLORS.dark : TRADE_TYPE_CHIP_COLORS.light;
  const includeCategory = showCategory ?? variant === "detail";
  const includeLocation = showLocation ?? variant === "detail";
  const location = getLocationLabel(product);
  const hasProductCoords = product.latitude != null && product.longitude != null;
  const computedDistanceKm =
    viewerLocation && hasProductCoords
      ? haversineDistanceKm(viewerLocation, {
          latitude: product.latitude as number,
          longitude: product.longitude as number,
        })
      : null;
  const computedDistanceLabel =
    computedDistanceKm != null ? formatDistanceLabel(computedDistanceKm) : null;
  const distanceLabel = distanceOverrideLabel ?? (
    computedDistanceKm != null && computedDistanceKm > 100 && fallbackDistanceLabel
      ? fallbackDistanceLabel
      : computedDistanceLabel ?? fallbackDistanceLabel
  );

  const chips: Array<{
    key: string;
    icon: "tag" | "package" | "map-pin" | "navigation";
    value: string;
    chipStyle: object;
    textStyle: object;
    lines?: number;
  }> = [];

  if (showProductType) {
    const typeColors = product.isFree
      ? tradeTypeColors.free
      : product.requestByMoney
        ? tradeTypeColors.money
        : tradeTypeColors.barter;
    chips.push({
      key: "type",
      icon: "package",
      value: getProductTypeLabel(product),
      chipStyle: { backgroundColor: typeColors.bg, borderColor: typeColors.border },
      textStyle: { color: typeColors.text },
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

  if (distanceLabel) {
    chips.push({
      key: "distance",
      icon: "navigation",
      value: distanceLabel,
      chipStyle: styles.metaChipDistance,
      textStyle: styles.metaChipTextDistance,
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, variant === "compact" && styles.containerCompact]}>
      {chips.map((chip) => (
        <View key={chip.key} style={[styles.metaChip, variant === "compact" && styles.metaChipCompact, chip.chipStyle]}>
          <Feather name={chip.icon} size={12} color={theme.colors.textMuted} style={styles.metaChipIcon} />
          <Text
            numberOfLines={chip.lines ?? 1}
            style={[styles.metaChipText, variant === "compact" && styles.metaChipTextCompact, chip.textStyle]}
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
    marginTop: 0,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  metaChipCompact: {
    paddingVertical: 3,
    minHeight: 24,
  },
  metaChipIcon: { marginTop: 0.5 },
  metaChipText: {
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 230,
  },
  metaChipTextCompact: {
    fontSize: 11,
  },
  metaChipCategory: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  metaChipTextCategory: { color: "#475569" },
  metaChipLocation: { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" },
  metaChipTextLocation: { color: "#0c4a6e" },
  metaChipDistance: { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  metaChipTextDistance: { color: "#92400e" },
});
