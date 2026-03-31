import { useEffect, useMemo, useState } from "react";

interface UseProductFeedFiltersOptions {
  limit?: number;
  excludeOwnerId?: string;
  debounceMs?: number;
}

export function useProductFeedFilters({
  limit = 20,
  excludeOwnerId,
  debounceMs = 300,
}: UseProductFeedFiltersOptions = {}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debounceMs, search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      categoryId: categoryId || undefined,
      excludeOwnerId: excludeOwnerId || undefined,
      limit,
    }),
    [debouncedSearch, categoryId, excludeOwnerId, limit],
  );

  return {
    search,
    debouncedSearch,
    isSearchDebouncing: search !== debouncedSearch,
    categoryId,
    filters,
    setSearch,
    setCategoryId,
  };
}
