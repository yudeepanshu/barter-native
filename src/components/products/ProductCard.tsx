import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProductSummary } from "@barter/types";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ProductExchangeBadge } from "@/components/products/ProductExchangeBadge";
import { ProductMetadata, hasExchangeHistory } from "@/components/products/ProductMetadata";

interface ProductCardProps {
  product: ProductSummary;
  onPress: () => void;
  showMeta?: boolean;
  isRequested?: boolean;
}

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "ACTIVE": return { bg: "#dcfce7", text: "#15803d" };
    case "RESERVED": return { bg: "#dbeafe", text: "#1d4ed8" };
    case "EXCHANGED": return { bg: "#ccfbf1", text: "#0f766e" };
    case "REMOVED": return { bg: "#fee2e2", text: "#b91c1c" };
    default: return { bg: "#e2e8f0", text: "#334155" };
  }
}

export function ProductCard({
  product,
  onPress,
  showMeta = true,
  isRequested = false,
}: ProductCardProps) {
  const { theme } = useAppTheme();
  const primaryImage = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0];
  const badgeStyle = getStatusBadgeStyle(product.status);

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
        {isRequested ? (
          <View
            style={[
              styles.badgeWithIcon,
              { backgroundColor: "#fcd34d", borderColor: "#f59e0b" },
            ]}
          >
            <Feather name="clock" size={12} color="#92400e" />
            <Text style={[styles.badgeText, { color: "#92400e" }]} numberOfLines={1}>
              Requested
            </Text>
          </View>
        ) : (
          <Text
            style={[styles.badge, { backgroundColor: badgeStyle.bg, color: badgeStyle.text }]}
            numberOfLines={1}
          >
            {product.status}
          </Text>
        )}
      </View>
      <Text style={[styles.cardDescription, { color: theme.colors.textMuted }]} numberOfLines={3}>
        {product.description || "No description provided."}
      </Text>
      {showMeta ? (
        <View style={styles.metaWrap}>
          <ProductMetadata
            product={product}
            variant="compact"
            showCategory={false}
            showLocation={false}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
    overflow: "hidden",
  },
  thumbnailContainer: {
    width: "100%",
    height: 166,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "800" },
  badge: {
    maxWidth: 96,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  badgeWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 96,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDescription: { fontSize: 13, lineHeight: 19 },
  metaWrap: { gap: 6 },
});
