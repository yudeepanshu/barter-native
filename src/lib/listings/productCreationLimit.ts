import type {
  InfiniteData,
  QueryClient,
} from "@tanstack/react-query";
import type { ProductsListResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

const DEFAULT_MAX_PRODUCTS_PER_USER = 5;
const PRODUCT_COUNT_QUERY_PAGE_SIZE = 100;
export const PRODUCT_LIMIT_CACHE_QUERY_LIMIT = 40;

const parsedMaxProductsPerUser = Number(process.env.EXPO_PUBLIC_MAX_PRODUCTS_PER_USER);

export const MAX_PRODUCTS_PER_USER =
  Number.isInteger(parsedMaxProductsPerUser) && parsedMaxProductsPerUser > 0
    ? parsedMaxProductsPerUser
    : DEFAULT_MAX_PRODUCTS_PER_USER;

export const getProductCreationLimitMessage = (maxProductsPerUser = MAX_PRODUCTS_PER_USER) =>
  `You can create up to ${maxProductsPerUser} listings only. Remove an existing listing to add a new one.`;

export function getCachedOwnedListingsCount(queryClient: QueryClient, userId: string) {
  const cached = queryClient.getQueryData<InfiniteData<ProductsListResult>>(
    queryKeys.products.infinite({ ownerId: userId, limit: PRODUCT_LIMIT_CACHE_QUERY_LIMIT }),
  );

  if (!cached) {
    return null;
  }

  return cached.pages
    .flatMap((page) => page.items)
    .filter((item) => item.status !== "REMOVED").length;
}

export async function checkProductCreationLimit(queryClient: QueryClient, userId: string) {
  const cachedCount = getCachedOwnedListingsCount(queryClient, userId);

  if (cachedCount != null) {
    return cachedCount >= MAX_PRODUCTS_PER_USER;
  }

  return hasReachedProductCreationLimit(userId);
}

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
