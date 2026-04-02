import type { NotificationsQueryInput, ProductsQueryInput } from "@barter/types";

function normalizeRequestsFilters(filters: { status?: string; limit?: number }) {
  return {
    status: filters.status ?? null,
    limit: filters.limit ?? 20,
  };
}

function normalizeProductsFilters(filters: ProductsQueryInput) {
  return {
    status: filters.status ?? null,
    categoryId: filters.categoryId ?? null,
    ownerId: filters.ownerId ?? null,
    excludeOwnerId: filters.excludeOwnerId ?? null,
    search: filters.search ?? null,
    limit: filters.limit ?? 20,
    cursor: filters.cursor ?? null,
    locationLat: filters.locationLat ?? null,
    locationLng: filters.locationLng ?? null,
    radiusKm: filters.radiusKm ?? null,
  };
}

function normalizeInfiniteProductsFilters(filters: Omit<ProductsQueryInput, "cursor">) {
  return {
    status: filters.status ?? null,
    categoryId: filters.categoryId ?? null,
    ownerId: filters.ownerId ?? null,
    excludeOwnerId: filters.excludeOwnerId ?? null,
    search: filters.search ?? null,
    limit: filters.limit ?? 20,
    locationLat: filters.locationLat ?? null,
    locationLng: filters.locationLng ?? null,
    radiusKm: filters.radiusKm ?? null,
  };
}

function normalizeNotificationsFilters(filters: Omit<NotificationsQueryInput, "cursor">) {
  return {
    limit: filters.limit ?? 20,
    unreadOnly: filters.unreadOnly ?? false,
  };
}

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  products: {
    list: (filters: ProductsQueryInput) => ["products", normalizeProductsFilters(filters)] as const,
    infinite: (filters: Omit<ProductsQueryInput, "cursor">) =>
      ["products", "infinite", normalizeInfiniteProductsFilters(filters)] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  requests: {
    sentInfinite: (filters: { status?: string; limit?: number }) =>
      ["requests", "sent", "infinite", normalizeRequestsFilters(filters)] as const,
    receivedInfinite: (filters: { status?: string; limit?: number }) =>
      ["requests", "received", "infinite", normalizeRequestsFilters(filters)] as const,
    detail: (id: string) => ["requests", "detail", id] as const,
  },
  notifications: {
    infinite: (filters: Omit<NotificationsQueryInput, "cursor">) =>
      ["notifications", "infinite", normalizeNotificationsFilters(filters)] as const,
  },
  transactions: {
    activeByRequest: (requestId: string) =>
      ["transactions", "active", "request", requestId] as const,
    activeByProduct: (productId: string) =>
      ["transactions", "active", "product", productId] as const,
  },
};
