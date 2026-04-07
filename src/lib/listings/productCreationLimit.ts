import { mobileApiClient } from "@/lib/api/client";

const DEFAULT_MAX_PRODUCTS_PER_USER = 5;
const PRODUCT_COUNT_QUERY_PAGE_SIZE = 100;

const parsedMaxProductsPerUser = Number(process.env.EXPO_PUBLIC_MAX_PRODUCTS_PER_USER);

export const MAX_PRODUCTS_PER_USER =
  Number.isInteger(parsedMaxProductsPerUser) && parsedMaxProductsPerUser > 0
    ? parsedMaxProductsPerUser
    : DEFAULT_MAX_PRODUCTS_PER_USER;

export const getProductCreationLimitMessage = (maxProductsPerUser = MAX_PRODUCTS_PER_USER) =>
  `You can create up to ${maxProductsPerUser} listings only. Remove an existing listing to add a new one.`;

export const hasReachedProductCreationLimit = async (userId: string) => {
  let cursor: string | undefined;
  let ownedActiveOrHistoricalCount = 0;

  do {
    const envelope = await mobileApiClient.getProducts({
      ownerId: userId,
      limit: PRODUCT_COUNT_QUERY_PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    });

    const page = envelope.data;
    if (!page) {
      return false;
    }

    ownedActiveOrHistoricalCount += page.items.filter((item) => item.status !== "REMOVED").length;
    if (ownedActiveOrHistoricalCount >= MAX_PRODUCTS_PER_USER) {
      return true;
    }

    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return false;
};
