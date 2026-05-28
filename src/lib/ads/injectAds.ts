import type { ProductSummary } from "@barter/types";
import { AD_EVERY_N_ITEMS } from "./adConfig";

export type AdPlaceholder = { type: "AD_PLACEHOLDER"; id: string };
export type FeedItem = ProductSummary | AdPlaceholder;

export function isAdPlaceholder(item: FeedItem): item is AdPlaceholder {
  return (item as AdPlaceholder).type === "AD_PLACEHOLDER";
}

export function injectAds(products: ProductSummary[], indexToInject: number = AD_EVERY_N_ITEMS): FeedItem[] {
  const result: FeedItem[] = [];
  products.forEach((product, index) => {
    result.push(product);
    const isAdSlot = (index + 1) % indexToInject === 0;
    if (isAdSlot) {
      result.push({ type: "AD_PLACEHOLDER", id: `ad-${index}` });
    }
  });
  return result;
}