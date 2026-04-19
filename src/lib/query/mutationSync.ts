import type {
  InfiniteData,
  QueryClient,
} from "@tanstack/react-query";
import type {
  ProductSummary,
  RequestMutationResult,
  TransactionSummary,
} from "@barter/types";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppStore } from "@/lib/store/appStore";

type ProductPage = {
  items: ProductSummary[];
  nextCursor: string | null;
  hasMore: boolean;
};

function replaceProductInPage(page: ProductPage, product: ProductSummary): ProductPage {
  return {
    ...page,
    items: page.items.map((item) => (item.id === product.id ? product : item)),
  };
}

export function syncProductEntity(queryClient: QueryClient, product: ProductSummary) {
  const store = useAppStore.getState();
  store.upsertProduct(product);

  queryClient.setQueryData(queryKeys.products.detail(product.id), product);

  queryClient.setQueriesData<InfiniteData<ProductPage>>(
    { queryKey: ["products", "infinite"] },
    (existing) => {
      if (!existing) {
        return existing;
      }

      return {
        ...existing,
        pages: existing.pages.map((page) => replaceProductInPage(page, product)),
      };
    },
  );
}

export function removeProductEntity(queryClient: QueryClient, productId: string) {
  const store = useAppStore.getState();
  store.removeProduct(productId);

  queryClient.removeQueries({ queryKey: queryKeys.products.detail(productId) });

  queryClient.setQueriesData<InfiniteData<ProductPage>>(
    { queryKey: ["products", "infinite"] },
    (existing) => {
      if (!existing) {
        return existing;
      }

      return {
        ...existing,
        pages: existing.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== productId),
        })),
      };
    },
  );
}

function sortOffers(
  offers: RequestMutationResult["request"]["offers"],
  order: "asc" | "desc",
) {
  return [...(offers ?? [])].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return order === "asc" ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function syncRequestMutationResult(
  queryClient: QueryClient,
  result: RequestMutationResult | null | undefined,
) {
  if (!result?.request) {
    return;
  }

  const request = result.request;
  const store = useAppStore.getState();

  store.upsertRequest(request);
  store.upsertOffers(request.id, request.offers ?? []);

  queryClient.setQueryData(queryKeys.requests.detail(request.id), request);

  queryClient.setQueryData(["requests", request.id, "offers", "desc"], {
    requestId: request.id,
    currentTurn: request.currentTurn,
    status: request.status,
    offers: sortOffers(request.offers, "desc"),
  });

  queryClient.setQueryData(["requests", request.id, "offers", "asc"], {
    requestId: request.id,
    currentTurn: request.currentTurn,
    status: request.status,
    offers: sortOffers(request.offers, "asc"),
  });
}

export function syncTransactionEntity(
  queryClient: QueryClient,
  transaction: TransactionSummary,
) {
  useAppStore.getState().upsertTransaction(transaction);
  queryClient.setQueryData(queryKeys.transactions.activeByRequest(transaction.requestId), transaction);
}

export function invalidateRequestCollections(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] }),
    queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] }),
  ]);
}

export function invalidateRequestCollectionByScope(
  queryClient: QueryClient,
  scope: "sent" | "received",
) {
  return queryClient.invalidateQueries({ queryKey: ["requests", scope, "infinite"] });
}

export function invalidateProductCollections(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["products", "infinite"] });
}

export function invalidateRequestAndProductCollections(queryClient: QueryClient) {
  return Promise.all([
    invalidateRequestCollections(queryClient),
    invalidateProductCollections(queryClient),
  ]);
}

export function invalidateTransactionForRequest(queryClient: QueryClient, requestId: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.transactions.activeByRequest(requestId),
  });
}

export function invalidateNotifications(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["notifications"] });
}
