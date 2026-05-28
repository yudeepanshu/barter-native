import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";
import { useAppTheme } from "@/hooks/useAppTheme";
import { NATIVE_AD_UNIT_ID } from "@/lib/ads/adConfig";

export function NativeAdCard() {
  const { theme } = useAppTheme();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    NativeAd.createForAdRequest(NATIVE_AD_UNIT_ID)
      .then(setNativeAd)
      .catch(console.error);

    return () => {
      nativeAd?.destroy();
    };
  }, []);

  if (!nativeAd) return null;

  return (
    <NativeAdView
      nativeAd={nativeAd}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {/* Sponsored badge */}
      <View style={styles.adBadgeRow}>
        <Text
          style={[
            styles.adBadge,
            {
              color: theme.colors.textMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          Sponsored
        </Text>
      </View>

      {/* Media — skip video ads on emulator */}
      {!nativeAd.mediaContent?.hasVideoContent && (
        <View style={styles.mediaWrapper}>
          <NativeMediaView style={styles.media} resizeMode="cover" />
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text
            style={[
              styles.headline,
              { color: theme.colors.textPrimary, textAlign: "center" },
            ]}
            numberOfLines={2}
          >
            {nativeAd.headline}
          </Text>
        </NativeAsset>

        {nativeAd.advertiser ? (
          <NativeAsset assetType={NativeAssetType.ADVERTISER}>
            <Text
              style={[
                styles.advertiser,
                { color: theme.colors.textMuted, textAlign: "center" },
              ]}
            >
              {nativeAd.advertiser}
            </Text>
          </NativeAsset>
        ) : null}

        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <View
              style={[
                styles.ctaButton,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={[styles.ctaText, { color: theme.colors.onPrimary }]}>
                {nativeAd.callToAction}
              </Text>
            </View>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  adBadgeRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  adBadge: {
    fontSize: 10,
    fontWeight: "700",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mediaWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  media: {
    width: 160,    
    height: 140,
  },
  body: {
    padding: 12,
    gap: 6,
    alignItems: "center",
  },
  headline: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  advertiser: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  ctaButton: {
    marginTop: 2,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "800",
  },
});