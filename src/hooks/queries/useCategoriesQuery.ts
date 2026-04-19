import { useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { writeStartupCategoriesSnapshot } from "@/lib/feed/feedSnapshotCache";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncEntityList } from "@/lib/store/useStoreSync";
import { useEffect } from "react";

export function useCategoriesQuery() {
  const session = useSession();
  const categoriesById = useAppDataStore((state) => state.categoriesById);
  const upsertCategories = useAppDataStore((state) => state.upsertCategories);
  const storeCategories = useMemo(
    () => Object.values(categoriesById).sort((left, right) => left.name.localeCompare(right.name)),
    [categoriesById],
  );

  const query = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const envelope = await mobileApiClient.getCategories();
      return envelope.data ?? [];
    },
    initialData: storeCategories.length > 0 ? storeCategories : undefined,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });

  useSyncEntityList(query.data, upsertCategories);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !query.data || query.data.length === 0) {
      return;
    }

    void writeStartupCategoriesSnapshot(userId, query.data);
  }, [query.data, session?.user.id]);

  return query;
}
