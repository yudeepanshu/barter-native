import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const envelope = await mobileApiClient.getCategories();
      return envelope.data ?? [];
    },
    staleTime: 30 * 60 * 1000,
  });
}
