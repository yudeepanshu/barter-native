import { useEffect, useState } from "react";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
} from "react-native-google-mobile-ads";
import { NATIVE_AD_UNIT_ID } from "@/lib/ads/adConfig";
import { TradeCardItem } from "@/screens/app/TradeCardItem";
import type { ProductImage, ProductStatus, RequestSummary } from "@barter/types";
import { useRouter } from "expo-router";

export function TradeCardAdItem() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const router = useRouter();

  useEffect(() => {
    NativeAd.createForAdRequest(NATIVE_AD_UNIT_ID)
      .then(setNativeAd)
      .catch(console.error);

    return () => {
      nativeAd?.destroy();
    };
  }, []);

  if (!nativeAd) return null;

  const fakeItem: RequestSummary = {
    id: "ad",
    status: "PENDING",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    product: {
      title: nativeAd.headline ?? "Sponsored",
      status: "AVAILABLE" as unknown as ProductStatus, // ad data, not a real product
      productImages: (
        nativeAd.icon?.url ? [nativeAd.icon.url] : []
      ) as unknown as ProductImage[],
    },
  } as unknown as RequestSummary;   // ← escape hatch; fakeItem is never used for real data

  return (
    <NativeAdView nativeAd={nativeAd}>
        <TradeCardItem
          item={fakeItem}
          router={router}
        //   actorTurn="SENDER"
          sessionUserId="ad"
          isAd
          adSubtitle={nativeAd.advertiser ?? nativeAd.body ?? ""}
          adBadgeLabel={nativeAd.callToAction ?? "Sponsored"}
        />
    </NativeAdView>
  );
}