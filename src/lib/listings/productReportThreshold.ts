import type { ProductSummary } from "@barter/types";

const parsedThreshold = Number(process.env.EXPO_PUBLIC_PRODUCT_REPORT_THRESHOLD);
export const PRODUCT_REPORT_THRESHOLD =
  Number.isFinite(parsedThreshold) && parsedThreshold >= 0 ? parsedThreshold : 3;

export function isProductReportedAboveThreshold(product: ProductSummary): boolean {
  return Boolean(product.reportCount && product.reportCount >= PRODUCT_REPORT_THRESHOLD);
}
