import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

export function useProfileQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const envelope = await mobileApiClient.getCurrentUser();
      return envelope.data ?? null;
    },
    enabled,
  });
}
