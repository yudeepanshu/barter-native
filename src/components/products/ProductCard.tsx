import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProductSummary } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ProductExchangeBadge } from "@/components/products/ProductExchangeBadge";
import { ProductMetadata, formatLocationBadgeLabel, hasExchangeHistory } from "@/components/products/ProductMetadata";
import { getContextTag, getTopTypeTag, ProductTag } from "@/components/products/ProductTags";

interface ProductCardProps {
  product: ProductSummary;
  onPress: () => void;
  showMeta?: boolean;
  isRequested?: boolean;
  viewerLocation?: { latitude: number; longitude: number } | null;
  fallbackDistanceLabel?: string | null;
}

export function ProductCard({
  product,
  onPress,
  showMeta = true,
  isRequested = false,
  viewerLocation = null,
  fallbackDistanceLabel = null,
}: ProductCardProps) {
  const { theme } = useAppTheme();
  const primaryImage = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0];
  const typeTag = getTopTypeTag(product);
  const contextTag = getContextTag(product, isRequested);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        theme.shadow.card,
        {
          borderRadius: theme.roundness,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          transform: [{ scale: pressed ? 0.992 : 1 }],
        },
      ]}
    >
      {primaryImage ? (
        <View style={[styles.thumbnailContainer, { backgroundColor: theme.colors.surfaceMuted }]}>
          <Image
            source={{ uri: primaryImage.url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          {hasExchangeHistory(product) ? <ProductExchangeBadge /> : null}
        </View>
      ) : null}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {product.title}
        </Text>
        <ProductTag tag={typeTag} variant="top-text" />
      </View>
      {showMeta ? (
        <View style={styles.metaWrap}>
          {contextTag ? <ProductTag tag={contextTag} variant="bottom-chip" /> : null}
          <ProductMetadata
            product={product}
            variant="compact"
            showCategory={false}
            showProductType={false}
            showLocation={false}
            viewerLocation={viewerLocation}
            fallbackDistanceLabel={fallbackDistanceLabel ?? formatLocationBadgeLabel(product.locationName)}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    overflow: "hidden",
  },
  thumbnailContainer: {
    height: 166,
    marginHorizontal: -12,
    marginTop: -0,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "800" },
  metaWrap: { gap: 6, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
});
