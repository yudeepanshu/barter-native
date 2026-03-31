import { useQuery } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";

export function useRequestOffersQuery(requestId: string) {
  return useQuery({
    queryKey: ["requests", requestId, "offers"],
    queryFn: async () => {
      const result = await mobileApiClient.getRequestOffers(requestId);
      return result.data;
    },
    enabled: Boolean(requestId),
  });
}
