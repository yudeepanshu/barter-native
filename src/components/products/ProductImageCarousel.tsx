import React, { useState } from "react";
import { View, ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { AppImage } from "@/components/ui/AppImage";
import { ImagePreviewModal } from "@/components/ui/ImagePreviewModal";
import { ProductTagSpec } from "./ProductTags";
import { ProductSummary } from "@barter/types";

interface ProductImageCarouselProps {
  product: ProductSummary;
  contextTag?: ProductTagSpec | null;
  isOwner?: boolean;
  imageFrameSize: number;
  theme: {
    colors: {
      surfaceMuted: string;
      border: string;
      primary: string;
    };
  };
  resolveImageBadge: (product: ProductSummary, contextTag: ProductTagSpec | null) => React.ReactNode;
  onImagePress?: (index: number) => void;
}

export function ProductImageCarousel({
  product,
  contextTag,
  isOwner,
  imageFrameSize,
  theme,
  resolveImageBadge,
  onImagePress,
}: ProductImageCarouselProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
 
  if (!product.productImages || product.productImages.length === 0) {
    return null;
  }
 
  return (
    <>
      <View style={styles.imageSection}>
        <View style={[styles.carouselWrapper, { width: imageFrameSize }]}>
          <ScrollView
            horizontal
            snapToInterval={imageFrameSize}
            snapToAlignment="center"
            decelerationRate="fast"
            scrollEnabled={true}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageScrollContent}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / imageFrameSize
              );
              setActiveImageIndex(
                Math.max(
                  0,
                  Math.min(nextIndex, product.productImages.length - 1)
                )
              );
            }}
            style={[
              styles.imageCarousel,
              {
                width: imageFrameSize,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
          >
            {product.productImages.map((image, index) => (
              <Pressable
                key={image.id}
                onPress={() => {
                  setPreviewIndex(index);
                  setPreviewVisible(true);
                  onImagePress?.(index);
                }}
                style={[
                  styles.imageContainer,
                  {
                    width: imageFrameSize,
                    height: imageFrameSize,
                    backgroundColor: theme.colors.surfaceMuted,
                    flexShrink: 0,
                  },
                ]}
              >
                <AppImage uri={image.url} style={styles.productImage} />
                {resolveImageBadge(product, contextTag ?? null)}
                {isOwner && image.isPrimary ? (
                  <Text style={styles.imagePrimaryBadge}>Primary</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
   
          {product.productImages.length > 1 && (
            <View style={styles.imagePagerOverlay} pointerEvents="none">
              <View style={styles.imageDotsRowOverlay}>
                {product.productImages.map((image, index) => (
                  <View
                    key={image.id}
                    style={[
                      styles.imageDot,
                      { backgroundColor: "rgba(255,255,255,0.45)" },
                      index === activeImageIndex
                        ? [styles.imageDotActive, { backgroundColor: "#fff" }]
                        : undefined,
                    ]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      <ImagePreviewModal
        images={product.productImages}
        initialIndex={previewIndex}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />
    </>
  );
}
 
const styles = StyleSheet.create({
  // ── Matches parent stylesheet ────────────────────────────────────────────
  imageSection: {
    marginVertical: 2,
    alignItems: "center",
  },
  imageCarousel: {
    borderRadius: 12,
    overflow: "hidden",
  },
  imageScrollContent: {
    alignItems: "center",
  },
  imageContainer: {
    position: "relative",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  imagePrimaryBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  // imageDotsRow, imageDot, imageDotActive kept in sync with parent:
  imageDotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  imageDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  imageDotActive: {
    width: 18,
  },
 
  // ── New styles only needed by this component ─────────────────────────────
  carouselWrapper: {
    // position: "relative" is the default stacking context for absolute children
    position: "relative",
  },
  // Replaces imagePagerWrap (which was below the image) — now overlaid on top
  imagePagerOverlay: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  imageDotsRowOverlay: {
    // Wraps imageDotsRow with a pill background for legibility over images
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.30)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    alignItems: "center",
  },
});
