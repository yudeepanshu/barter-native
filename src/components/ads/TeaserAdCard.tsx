import { useEffect, useState } from "react";
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType } from "react-native-google-mobile-ads";
import { NATIVE_AD_UNIT_ID } from "@/lib/ads/adConfig";
import { TeaserCard } from "@/components/ui/TeaserCard";

export function TeaserAdCard() {
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
    <NativeAdView nativeAd={nativeAd}>
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <TeaserCard
            imageUri={nativeAd.icon?.url}
            title={nativeAd.headline ?? "Sponsored"}
            subtitle={nativeAd.advertiser ?? nativeAd.body ?? ""}
            badge="Sponsored"
            onPress={() => {}}
            accessibilityLabel={`Ad: ${nativeAd.headline}`}
        />
      </NativeAsset>
    </NativeAdView>
  );
}