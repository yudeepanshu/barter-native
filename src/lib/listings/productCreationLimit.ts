import type {
  InfiniteData,
  QueryClient,
} from "@tanstack/react-query";
import type { ProductsListResult } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

const DEFAULT_MAX_PRODUCTS_PER_USER = 5;
export const PRODUCT_LIMIT_CACHE_QUERY_LIMIT = 40;

const parsedMaxProductsPerUser = Number(process.env.EXPO_PUBLIC_MAX_PRODUCTS_PER_USER);

export const MAX_PRODUCTS_PER_USER =
  Number.isInteger(parsedMaxProductsPerUser) && parsedMaxProductsPerUser > 0
    ? parsedMaxProductsPerUser
    : DEFAULT_MAX_PRODUCTS_PER_USER;

export const getProductCreationLimitMessage = (maxProductsPerUser = MAX_PRODUCTS_PER_USER) =>
  `You can create up to ${maxProductsPerUser} listings only. Remove an existing listing to add a new one.`;

function countNonRemovedListings(pages: ProductsListResult[]) {
  return pages
    .flatMap((page) => page.items)
    .filter((item) => item.status !== "REMOVED").length;
}

export function getCachedOwnedListingsCount(queryClient: QueryClient, userId: string) {
  const cached = queryClient.getQueryData<InfiniteData<ProductsListResult>>(
    queryKeys.products.infinite({ ownerId: userId, limit: PRODUCT_LIMIT_CACHE_QUERY_LIMIT }),
  );

  if (!cached) {
    return null;
  }

  return countNonRemovedListings(cached.pages);
}

export async function checkProductCreationLimit(queryClient: QueryClient, userId: string) {
  const cachedCount = getCachedOwnedListingsCount(queryClient, userId);

  if (cachedCount != null) {
    return cachedCount >= MAX_PRODUCTS_PER_USER;
  }

  return hasReachedProductCreationLimit(queryClient, userId);
}

export const hasReachedProductCreationLimit = async (queryClient: QueryClient, userId: string) => {
  const cacheKey = queryKeys.products.infinite({
    ownerId: userId,
    limit: PRODUCT_LIMIT_CACHE_QUERY_LIMIT,
  });

  const existing = queryClient.getQueryData<InfiniteData<ProductsListResult>>(cacheKey);
  const pages: ProductsListResult[] = existing?.pages ? [...existing.pages] : [];
  const pageParams: Array<string | null> =
    existing?.pageParams?.map((param) => (typeof param === "string" ? param : null)) ?? [];

  let cursor: string | undefined;
  let ownedActiveOrHistoricalCount = countNonRemovedListings(pages);

  if (ownedActiveOrHistoricalCount >= MAX_PRODUCTS_PER_USER) {
    return true;
  }

  const lastCachedPage = pages[pages.length - 1];
  if (lastCachedPage && !lastCachedPage.hasMore) {
    return false;
  }

  if (lastCachedPage?.hasMore) {
    cursor = lastCachedPage.nextCursor ?? undefined;
  }

  do {
    const envelope = await mobileApiClient.getProducts({
      ownerId: userId,
      limit: PRODUCT_LIMIT_CACHE_QUERY_LIMIT,
      ...(cursor ? { cursor } : {}),
    });

    const page = envelope.data;
    if (!page) {
      return false;
    }

    pages.push(page);
    pageParams.push(cursor ?? null);

    queryClient.setQueryData(cacheKey, {
      pages,
      pageParams,
    } satisfies InfiniteData<ProductsListResult>);

    ownedActiveOrHistoricalCount += page.items.filter((item) => item.status !== "REMOVED").length;
    if (ownedActiveOrHistoricalCount >= MAX_PRODUCTS_PER_USER) {
      return true;
    }

    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return false;
};
