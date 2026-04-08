import type { ProductsQueryInput } from "@barter/types";
import { useEffect, useMemo } from "react";
import { useProductsQuery } from "@/hooks/queries/useProductsQuery";
import { useAppDataStore } from "@/lib/store/appDataStore";

interface ProductsListControllerOptions {
  enabled?: boolean;
}

export function useProductsListController(
  filters: Omit<ProductsQueryInput, "cursor">,
  options: ProductsListControllerOptions = {},
) {
  const query = useProductsQuery(filters, options);
  const storeProducts = useAppDataStore((state) => state.productsById);
  const upsertProducts = useAppDataStore((state) => state.upsertProducts);

  const queryItems = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const fallbackItems = useMemo(() => {
    const allProducts = Object.values(storeProducts);
    return allProducts.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (filters.ownerId && item.currentOwnerId !== filters.ownerId) return false;
      if (filters.excludeOwnerId && item.currentOwnerId === filters.excludeOwnerId) return false;
      if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [storeProducts, filters]);

  const items = queryItems.length > 0 ? queryItems : fallbackItems;

  useEffect(() => {
    if (queryItems.length > 0) {
      upsertProducts(queryItems);
    }
  }, [queryItems, upsertProducts]);

  const refresh = () => void query.refetch();

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  return {
    query,
    items,
    isEmpty: !query.isPending && !query.error && items.length === 0,
    refresh,
    loadMore,
  };
}
