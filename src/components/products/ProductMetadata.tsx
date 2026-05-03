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
  canShowRelativeDistance?: boolean;
  fallbackDistanceLabel?: string | null;
  distanceOverrideKm?: number | null;
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
  const kmText = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();
  return `${kmText} km away`;
}

const RELATIVE_DISTANCE_MAX_KM = 60;

export function getDistanceBadgeLabel(
  canShowRelativeDistance: boolean,
  distanceKm?: number | null,
  fallbackDistanceLabel?: string | null,
) {
  if (canShowRelativeDistance && distanceKm != null && distanceKm <= RELATIVE_DISTANCE_MAX_KM) {
    return formatDistanceLabel(distanceKm);
  }

  return fallbackDistanceLabel ?? null;
}

export function getProductTypeLabel(product: ProductSummary) {
  if (product.isFree) return "Free";
  
  if (product.requestByMoney && product.allowTradeRequest) return "Cash or Trade";
  if (product.requestByMoney) return "Cash Only";
  return "Trade Only";
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
  canShowRelativeDistance = true,
  fallbackDistanceLabel = null,
  distanceOverrideKm = null,
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
  const effectiveDistanceKm = computedDistanceKm ?? distanceOverrideKm;
  const distanceLabel = getDistanceBadgeLabel(canShowRelativeDistance, effectiveDistanceKm, fallbackDistanceLabel);

  // Distance takes priority over location — only one is shown at a time
  const locationOrDistance = distanceLabel ?? (includeLocation && location ? location : null);
  const isShowingDistance = !!distanceLabel;

  const chips: Array<{
    key: string;
    icon: "tag" | "package" | "map-pin";
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

  const hasChips = chips.length > 0;
  const hasInlineItems = !!locationOrDistance || includeCategory;

  if (!hasChips && !hasInlineItems) {
    return null;
  }

  return (
    <View style={[styles.container, variant === "compact" && styles.containerCompact]}>
      {/* Chips row: type only */}
      {hasChips && (
        <View style={styles.chipsRow}>
          {chips.map((chip) => (
            <View
              key={chip.key}
              style={[styles.metaChip, variant === "compact" && styles.metaChipCompact, chip.chipStyle]}
            >
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
      )}

      {/* Inline text row: category · (distance OR location) */}
      {hasInlineItems && (
        <View style={styles.inlineRow}>
          {locationOrDistance && (
            <Feather
              name="map-pin"
              size={variant === "compact" ? 11 : 12}
              color={theme.colors.textMuted}
              style={styles.inlineIcon}
            />
          )}
          {locationOrDistance && (
            <Text
              numberOfLines={isShowingDistance ? 1 : locationLines}
              style={[
                styles.inlineText,
                variant === "compact" && styles.inlineTextCompact,
                { color: theme.colors.textMuted },
              ]}
            >
              {locationOrDistance}
            </Text>
          )}

          {includeCategory && locationOrDistance && (
            <Text style={[styles.inlineSeparator, { color: theme.colors.textMuted }]}>·</Text>
          )}

          {includeCategory && (
            <Feather
              name="tag"
              size={variant === "compact" ? 11 : 12}
              color={theme.colors.textMuted}
              style={styles.inlineIcon}
            />
          )}
          {includeCategory && (
            <Text
              numberOfLines={1}
              style={[
                styles.inlineText,
                variant === "compact" && styles.inlineTextCompact,
                { color: theme.colors.textMuted },
              ]}
            >
              {getCategoryLabel(product)}
            </Text>
          )}

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  containerCompact: {
    marginTop: 0,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  // Inline text styles for category, location + distance
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  inlineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  inlineIcon: {
    marginTop: 0.5,
  },
  inlineText: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
  inlineTextCompact: {
    fontSize: 11,
  },
  inlineSeparator: {
    fontSize: 12,
    fontWeight: "500",
    marginHorizontal: 4,
  },
});