import React from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ProductSummary } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Button } from "@/components/ui/Button";
import { ProductMetadata } from "@/components/products/ProductMetadata";
import { getTopTypeTag, ProductTag } from "@/components/products/ProductTags";

interface SelectableProductGridProps {
  products: ProductSummary[];
  selectedProductIds: string[];
  onToggleProduct: (productId: string) => void;
  emptyText: string;
  owner?: { userName: string; profilePicture?: string | null };
}

export function SelectableProductGrid({
  products,
  selectedProductIds,
  onToggleProduct,
  emptyText,
  owner,
}: SelectableProductGridProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const [previewProduct, setPreviewProduct] = React.useState<ProductSummary | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = React.useState(0);
  const previewImageSize = Math.max(220, Math.round(width - 72));

  if (products.length === 0) {
    return <Text style={[styles.hintText, { color: theme.colors.textMuted }]}>{emptyText}</Text>;
  }

  return (
    <>
      <View style={styles.grid}>
        {products.map((item) => {
          const selected = selectedProductIds.includes(item.id);
          const previewUri = item.productImages.find((img) => img.url)?.url ?? null;

          return (
            <Pressable
              key={item.id}
              onPress={() => onToggleProduct(item.id)}
              style={[
                styles.tile,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
                selected ? [styles.tileActive, { borderColor: theme.colors.primary }] : undefined,
              ]}
            >
              <View style={styles.thumbWrap}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumbFallback, { backgroundColor: theme.colors.surface }]}>
                    <Feather name="image" size={14} color={theme.colors.textMuted} />
                  </View>
                )}
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setPreviewProduct(item);
                    setPreviewImageIndex(0);
                  }}
                  hitSlop={8}
                  style={[styles.previewEyeButton, { backgroundColor: "rgba(15,23,42,0.7)" }]}
                >
                  <Feather name="eye" size={12} color="#F5A623" />
                </Pressable>
              </View>
              <Text
                style={[
                  styles.tileTitle,
                  { color: selected ? theme.colors.primary : theme.colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={Boolean(previewProduct)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewProduct(null)}
      >
        <View style={[styles.previewBackdrop, { backgroundColor: theme.colors.overlay }]}>
          {/* Backdrop: absolute fill behind card — only fires when tapping outside the card */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewProduct(null)} />

          {/* Card: sibling to backdrop Pressable, rendered on top — no Pressable wrapping it */}
          <View style={styles.previewCardWrapper} pointerEvents="box-none">
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
              {previewProduct ? (
                <>
                  <View style={styles.previewHeaderRow}>
                    <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                      {previewProduct.title}
                    </Text>
                    <ProductTag tag={getTopTypeTag(previewProduct)} variant="top-text" />
                  </View>

                  {owner ? (
                    <View style={styles.previewOwnerRow}>
                      {owner.profilePicture ? (
                        <Image source={{ uri: owner.profilePicture }} style={[styles.previewOwnerAvatar, { backgroundColor: theme.colors.surfaceMuted }]} />
                      ) : (
                        <View style={[styles.previewOwnerAvatar, styles.previewOwnerAvatarFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
                          <Text style={[styles.previewOwnerInitial, { color: theme.colors.primary }]}>
                            {(owner.userName ?? "?").slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.previewOwnerMeta}>
                        <Text style={[styles.previewOwnerLabel, { color: theme.colors.textMuted }]}>Listed by</Text>
                        <Text style={[styles.previewOwnerName, { color: theme.colors.textPrimary }]}>
                          {owner.userName}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {previewProduct.productImages.length > 0 ? (
                    <>
                      <ScrollView
                        horizontal
                        snapToInterval={previewImageSize}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        scrollEventThrottle={16}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.previewImageScrollContent}
                        onScroll={(event) => {
                          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / previewImageSize);
                          setPreviewImageIndex(Math.max(0, Math.min(nextIndex, previewProduct.productImages.length - 1)));
                        }}
                        style={[styles.previewImageCarousel, { width: previewImageSize, height: previewImageSize, backgroundColor: theme.colors.surfaceMuted }]}
                      >
                        {previewProduct.productImages.map((image) => (
                          <View
                            key={image.id}
                            style={{ width: previewImageSize, height: previewImageSize, backgroundColor: theme.colors.surfaceMuted }}
                          >
                            <Image source={{ uri: image.url }} style={styles.previewImage} />
                          </View>
                        ))}
                      </ScrollView>
                      {previewProduct.productImages.length > 1 ? (
                        <Text style={[styles.previewPagerText, { color: theme.colors.textMuted }]}>
                          Image {previewImageIndex + 1} of {previewProduct.productImages.length}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  <Text style={[styles.previewDescription, { color: theme.colors.textMuted }]}>
                    {previewProduct.description || "No description provided."}
                  </Text>

                  <ProductMetadata
                    product={previewProduct}
                    variant="detail"
                    showProductType={false}
                    showLocation
                  />
                </>
              ) : null}

              <Button label="Close" onPress={() => setPreviewProduct(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hintText: { fontSize: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  tile: {
    width: 74,
    borderWidth: 1,
    borderRadius: 7,
    overflow: "hidden",
  },
  tileActive: {
    borderWidth: 2,
  },
  thumbWrap: {
    position: "relative",
    width: "100%",
    height: 46,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewEyeButton: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    fontSize: 9,
    fontWeight: "600",
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  previewBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  previewCardWrapper: {
    justifyContent: "center",
  },
  previewCard: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
    maxHeight: "90%",
  },
  previewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  previewTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  previewOwnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewOwnerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  previewOwnerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  previewOwnerInitial: {
    fontSize: 13,
    fontWeight: "800",
  },
  previewOwnerMeta: {
    gap: 1,
  },
  previewOwnerLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  previewOwnerName: {
    fontSize: 14,
    fontWeight: "700",
  },
  previewImageCarousel: {
    borderRadius: 12,
    overflow: "hidden",
    alignSelf: "center",
  },
  previewImageScrollContent: {
    alignItems: "flex-start",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewPagerText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
