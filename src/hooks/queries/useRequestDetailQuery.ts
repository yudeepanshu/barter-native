import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";

export function useRequestDetailQuery(requestId: string) {
  return useQuery({
    queryKey: ["requests", requestId],
    queryFn: async () => {
      const result = await mobileApiClient.getRequestById(requestId);
      return result.data;
    },
    enabled: Boolean(requestId),
  });
}
