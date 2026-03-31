import type { ProductsQueryInput } from "@barter/types";
import { useProductsQuery } from "@/hooks/queries/useProductsQuery";

export function useProductsListController(filters: Omit<ProductsQueryInput, "cursor">) {
  const query = useProductsQuery(filters);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

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
