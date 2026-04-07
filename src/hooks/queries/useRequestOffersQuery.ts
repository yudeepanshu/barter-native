import { useQuery } from "@tanstack/react-query";
import type { RequestOffersQueryInput } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";

export function useRequestOffersQuery(requestId: string, query?: RequestOffersQueryInput) {
  return useQuery({
    queryKey: ["requests", requestId, "offers", query?.order ?? "desc"],
    queryFn: async () => {
      const result = await mobileApiClient.getRequestOffers(requestId, query);
      return result.data;
    },
    enabled: Boolean(requestId),
  });
}
