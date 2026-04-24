import type {
  ProductSummary,
  ProductsListResult,
  ProductStatus,
  RequestOffersResult,
  RequestStatus,
  RequestSummary,
  RequestTurn,
  RequestsListResult,
  TransactionSummary,
} from "@barter/types";
import type {
  InfiniteData,
  QueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { useAppStore } from "@/lib/store/appStore";
import type { DomainEvent } from "@/lib/realtime/types";

type RequestsInfiniteData = InfiniteData<RequestsListResult>;
type ProductsInfiniteData = InfiniteData<ProductsListResult>;

type RequestRealtimePatch = {
  requestId: string;
  status: RequestStatus;
  currentTurn?: RequestTurn;
  message?: string | null;
  updatedAt: string;
};

function shouldRefetchRequestOffers(action: DomainEvent<"request.updated">["payload"]["action"]) {
  return (
    action === "CREATED" ||
    action === "COUNTERED" ||
    action === "ACCEPTED" ||
    action === "REJECTED" ||
    action === "CANCELLED" ||
    action === "EXPIRED"
  );
}

function shouldRefetchRequestDetail(action: DomainEvent<"request.updated">["payload"]["action"]) {
  return (
    action === "CONTACT_REVEAL_REQUESTED" ||
    action === "CONTACT_REVEAL_RESPONDED"
  );
}

function shouldRefetchProductCollections(action: DomainEvent<"product.updated">["payload"]["action"]) {
  return (
    action === "CREATED" ||
    action === "RELISTED" ||
    action === "REMOVED" ||
    action === "RESERVED" ||
    action === "EXCHANGED" ||
    action === "OWNERSHIP_TRANSFERRED"
  );
}

function patchRequestSummary(
  request: RequestSummary,
  patch: RequestRealtimePatch,
): RequestSummary {
  return {
    ...request,
    status: patch.status,
    updatedAt: patch.updatedAt,
    ...(patch.currentTurn ? { currentTurn: patch.currentTurn } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'message') ? { message: patch.message } : {}),
  };
}

function patchRequestInInfiniteCollections(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  patch: RequestRealtimePatch,
) {
  let matched = false;

  queryClient.setQueriesData<RequestsInfiniteData>({ queryKey }, (existing) => {
    if (!existing) {
      return existing;
    }

    let didChange = false;
    const nextPages = existing.pages.map((page) => {
      let pageChanged = false;
      const nextItems = page.items.map((item) => {
        if (item.id !== patch.requestId) {
          return item;
        }

        matched = true;
        pageChanged = true;
        return patchRequestSummary(item, patch);
      });

      if (!pageChanged) {
        return page;
      }

      didChange = true;
      return {
        ...page,
        items: nextItems,
      };
    });

    if (!didChange) {
      return existing;
    }

    return {
      ...existing,
      pages: nextPages,
    };
  });

  return matched;
}

function patchRequestDetailCache(queryClient: QueryClient, patch: RequestRealtimePatch) {
  let matched = false;

  queryClient.setQueryData<RequestSummary | null | undefined>(
    queryKeys.requests.detail(patch.requestId),
    (existing) => {
      if (!existing) {
        return existing;
      }

      matched = true;
      return patchRequestSummary(existing, patch);
    },
  );

  return matched;
}

function patchRequestOffersCache(queryClient: QueryClient, patch: RequestRealtimePatch) {
  queryClient.setQueriesData<RequestOffersResult | null | undefined>(
    { queryKey: ["requests", patch.requestId, "offers"] },
    (existing) => {
      if (!existing) {
        return existing;
      }

      return {
        ...existing,
        status: patch.status,
        ...(patch.currentTurn ? { currentTurn: patch.currentTurn } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'message') ? { message: patch.message } : {}),
      };
    },
  );
}

function patchProductSummary(
  product: ProductSummary,
  patch: {
    status: ProductStatus;
    isListed: boolean;
    updatedAt: string;
  },
): ProductSummary {
  return {
    ...product,
    status: patch.status,
    isListed: patch.isListed,
    updatedAt: patch.updatedAt,
  };
}

function patchProductDetailCache(
  queryClient: QueryClient,
  productId: string,
  patch: {
    status: ProductStatus;
    isListed: boolean;
    updatedAt: string;
  },
) {
  let matched = false;

  queryClient.setQueryData<ProductSummary | null | undefined>(
    queryKeys.products.detail(productId),
    (existing) => {
      if (!existing) {
        return existing;
      }

      matched = true;
      return patchProductSummary(existing, patch);
    },
  );

  return matched;
}

function patchProductInInfiniteCollections(
  queryClient: QueryClient,
  patch: {
    productId: string;
    status: ProductStatus;
    isListed: boolean;
    updatedAt: string;
  },
) {
  let matched = false;

  queryClient.setQueriesData<ProductsInfiniteData>(
    { queryKey: ["products", "infinite"] },
    (existing) => {
      if (!existing) {
        return existing;
      }

      let didChange = false;
      const nextPages = existing.pages.map((page) => {
        let pageChanged = false;
        const nextItems = page.items.map((item) => {
          if (item.id !== patch.productId) {
            return item;
          }

          matched = true;
          pageChanged = true;
          return patchProductSummary(item, patch);
        });

        if (!pageChanged) {
          return page;
        }

        didChange = true;
        return {
          ...page,
          items: nextItems,
        };
      });

      if (!didChange) {
        return existing;
      }

      return {
        ...existing,
        pages: nextPages,
      };
    },
  );

  return matched;
}

function patchTransactionActiveByRequestCache(
  queryClient: QueryClient,
  requestId: string,
  status: TransactionSummary["status"],
  updatedAt: string,
) {
  let matched = false;

  queryClient.setQueryData<TransactionSummary | null>(
    queryKeys.transactions.activeByRequest(requestId),
    (existing) => {
      if (!existing) {
        return existing;
      }

      matched = true;
      return {
        ...existing,
        status,
        ...(status === "COMPLETED" ? { completedAt: updatedAt } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: updatedAt } : {}),
      };
    },
  );

  return matched;
}

function handleRequestUpdated(event: DomainEvent<"request.updated">, queryClient: QueryClient) {
  const { action, requestId, status, currentTurn, message } = event.payload;

  const patch: RequestRealtimePatch = {
    requestId,
    status: status as RequestStatus,
    updatedAt: event.occurredAt,
    ...(currentTurn ? { currentTurn: currentTurn as RequestTurn } : {}),
    ...(Object.prototype.hasOwnProperty.call(event.payload, 'message') ? { message } : {}),
  };

  useAppStore.getState().patchRequest(requestId, {
    status: patch.status,
    ...(patch.currentTurn ? { currentTurn: patch.currentTurn } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'message') ? { message: patch.message } : {}),
  });

  const detailMatched = patchRequestDetailCache(queryClient, patch);
  const sentMatched = patchRequestInInfiniteCollections(
    queryClient,
    ["requests", "sent", "infinite"],
    patch,
  );
  const receivedMatched = patchRequestInInfiniteCollections(
    queryClient,
    ["requests", "received", "infinite"],
    patch,
  );
  patchRequestOffersCache(queryClient, patch);

  const foundInActiveCache = detailMatched || sentMatched || receivedMatched;
  const shouldRefetchCollections = action === "CREATED" || !foundInActiveCache;
  const hasMessageUpdate = Object.prototype.hasOwnProperty.call(event.payload, 'message');

  if (!detailMatched || shouldRefetchRequestDetail(action) || hasMessageUpdate) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
  }

  if (shouldRefetchCollections) {
    void queryClient.invalidateQueries({ queryKey: ["requests", "sent", "infinite"] });
    void queryClient.invalidateQueries({ queryKey: ["requests", "received", "infinite"] });
  }

  if (shouldRefetchRequestOffers(action) || hasMessageUpdate) {
    void queryClient.invalidateQueries({ queryKey: ["requests", requestId, "offers"] });
  }
}

function handleProductUpdated(event: DomainEvent<"product.updated">, queryClient: QueryClient) {
  const { action, productId, status, isListed, relatedRequestId } = event.payload;

  const patch = {
    status: status as ProductStatus,
    isListed,
    updatedAt: event.occurredAt,
  };

  useAppStore.getState().patchProduct(productId, {
    status: patch.status,
    isListed: patch.isListed,
  });

  const detailMatched = patchProductDetailCache(queryClient, productId, patch);
  const collectionMatched = patchProductInInfiniteCollections(queryClient, {
    productId,
    ...patch,
  });

  if (!detailMatched) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
  }

  if (shouldRefetchProductCollections(action) || !collectionMatched) {
    void queryClient.invalidateQueries({ queryKey: ["products", "infinite"] });
  }

  if (relatedRequestId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(relatedRequestId) });
  }
}

function handleTransactionUpdated(event: DomainEvent<"transaction.updated">, queryClient: QueryClient) {
  const { transactionId, requestId, productId, status } = event.payload;
  const normalizedStatus = status as TransactionSummary["status"];

  useAppStore.getState().patchTransaction(transactionId, {
    status: normalizedStatus,
  });

  const hasActiveTransactionCache = patchTransactionActiveByRequestCache(
    queryClient,
    requestId,
    normalizedStatus,
    event.occurredAt,
  );

  if (!hasActiveTransactionCache) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.activeByRequest(requestId) });
  }

  void queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
}

function handleNotificationUpdated(
  event: DomainEvent<"notification.updated">,
  queryClient: QueryClient,
) {
  const { action, notificationId, unreadCount } = event.payload;

  if (typeof unreadCount === "number") {
    useAppStore.getState().setNotificationsUnreadCount(unreadCount);
  }

  if (action === "READ" && notificationId) {
    useAppStore.getState().patchNotification(notificationId, {
      isRead: true,
    });
  }

  if (action === "CLEARED_ALL") {
    useAppStore.getState().setNotificationsUnreadCount(0);
  }

  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

function isDomainEvent(value: unknown): value is DomainEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DomainEvent>;
  return Boolean(candidate.type && candidate.payload);
}

export function handleRealtimeEvent(event: unknown, queryClient: QueryClient) {
  if (!isDomainEvent(event)) {
    return;
  }

  switch (event.type) {
    case "request.updated": {
      handleRequestUpdated(event as DomainEvent<"request.updated">, queryClient);
      break;
    }
    case "product.updated": {
      handleProductUpdated(event as DomainEvent<"product.updated">, queryClient);
      break;
    }
    case "transaction.updated": {
      handleTransactionUpdated(event as DomainEvent<"transaction.updated">, queryClient);
      break;
    }
    case "notification.updated": {
      handleNotificationUpdated(event as DomainEvent<"notification.updated">, queryClient);
      break;
    }
    default:
      break;
  }
}
