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
  const [proximity, setProximity] = useState<{
    latitude: number;
    longitude: number;
    radiusKm: number;
  } | null>(null);

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
      locationLat: proximity?.latitude,
      locationLng: proximity?.longitude,
      radiusKm: proximity?.radiusKm,
    }),
    [debouncedSearch, categoryId, excludeOwnerId, limit, proximity],
  );

  return {
    search,
    debouncedSearch,
    isSearchDebouncing: search !== debouncedSearch,
    categoryId,
    proximity,
    filters,
    setSearch,
    setCategoryId,
    setProximity,
  };
}
