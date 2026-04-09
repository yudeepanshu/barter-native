import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useSyncNullableEntity } from "@/lib/store/useStoreSync";

export function useProfileQuery(enabled = true) {
  const setProfile = useAppDataStore((state) => state.setProfile);

  const query = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const envelope = await mobileApiClient.getCurrentUser();
      return envelope.data ?? null;
    },
    enabled,
  });

  useSyncNullableEntity(query.data, setProfile);

  return query;
}
