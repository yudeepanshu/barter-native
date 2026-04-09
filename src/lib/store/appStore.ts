import { create } from "zustand";
import type {
  AuthUser,
  NotificationSummary,
  ProductSummary,
  RequestOffer,
  RequestSummary,
  TransactionSummary,
} from "@barter/types";
import { patchOne, removeOne, upsertMany, upsertOne } from "@/lib/store/entityUtils";

type OfferById = Record<string, RequestOffer>;

type StoreSetter<TState> = (
  partial:
    | Partial<TState>
    | TState
    | ((state: TState) => Partial<TState> | TState),
) => void;

interface ProductsSlice {
  productsById: Record<string, ProductSummary>;
  upsertProducts: (products: ProductSummary[]) => void;
  upsertProduct: (product: ProductSummary) => void;
  patchProduct: (productId: string, patch: Partial<ProductSummary>) => void;
  removeProduct: (productId: string) => void;
}

interface RequestsSlice {
  requestsById: Record<string, RequestSummary>;
  upsertRequests: (requests: RequestSummary[]) => void;
  upsertRequest: (request: RequestSummary) => void;
  patchRequest: (requestId: string, patch: Partial<RequestSummary>) => void;
}

interface OffersSlice {
  offersByRequestId: Record<string, OfferById>;
  upsertOffers: (requestId: string, offers: RequestOffer[]) => void;
  patchOffer: (requestId: string, offerId: string, patch: Partial<RequestOffer>) => void;
}

interface TransactionsSlice {
  transactionsById: Record<string, TransactionSummary>;
  upsertTransactions: (transactions: TransactionSummary[]) => void;
  upsertTransaction: (transaction: TransactionSummary) => void;
  patchTransaction: (transactionId: string, patch: Partial<TransactionSummary>) => void;
}

interface NotificationsSlice {
  notificationsById: Record<string, NotificationSummary>;
  notificationsUnreadCount: number;
  upsertNotifications: (notifications: NotificationSummary[]) => void;
  upsertNotification: (notification: NotificationSummary) => void;
  patchNotification: (notificationId: string, patch: Partial<NotificationSummary>) => void;
  removeNotification: (notificationId: string) => void;
  setNotificationsUnreadCount: (count: number) => void;
}

interface ProfileSlice {
  profile: AuthUser | null;
  setProfile: (profile: AuthUser | null) => void;
  patchProfile: (patch: Partial<AuthUser>) => void;
}

export interface AppStore
  extends ProductsSlice,
    RequestsSlice,
    OffersSlice,
    TransactionsSlice,
    NotificationsSlice,
    ProfileSlice {
  reset: () => void;
}

const EMPTY_STATE = {
  productsById: {},
  requestsById: {},
  offersByRequestId: {},
  transactionsById: {},
  notificationsById: {},
  notificationsUnreadCount: 0,
  profile: null,
} satisfies Pick<
  AppStore,
  | "productsById"
  | "requestsById"
  | "offersByRequestId"
  | "transactionsById"
  | "notificationsById"
  | "notificationsUnreadCount"
  | "profile"
>;

const createProductsSlice = (set: StoreSetter<AppStore>): ProductsSlice => ({
  productsById: {},
  upsertProducts: (products) => {
    set((state) => ({ productsById: upsertMany(state.productsById, products) }));
  },
  upsertProduct: (product) => {
    set((state) => ({ productsById: upsertOne(state.productsById, product) }));
  },
  patchProduct: (productId, patch) => {
    set((state) => ({ productsById: patchOne(state.productsById, productId, patch) }));
  },
  removeProduct: (productId) => {
    set((state) => ({ productsById: removeOne(state.productsById, productId) }));
  },
});

const createRequestsSlice = (set: StoreSetter<AppStore>): RequestsSlice => ({
  requestsById: {},
  upsertRequests: (requests) => {
    set((state) => ({ requestsById: upsertMany(state.requestsById, requests) }));
  },
  upsertRequest: (request) => {
    set((state) => ({ requestsById: upsertOne(state.requestsById, request) }));
  },
  patchRequest: (requestId, patch) => {
    set((state) => ({ requestsById: patchOne(state.requestsById, requestId, patch) }));
  },
});

const createOffersSlice = (set: StoreSetter<AppStore>): OffersSlice => ({
  offersByRequestId: {},
  upsertOffers: (requestId, offers) => {
    set((state) => {
      const currentById = state.offersByRequestId[requestId] ?? {};
      const nextById = upsertMany(currentById, offers);

      return {
        offersByRequestId: {
          ...state.offersByRequestId,
          [requestId]: nextById,
        },
      };
    });
  },
  patchOffer: (requestId, offerId, patch) => {
    set((state) => {
      const currentById = state.offersByRequestId[requestId];
      if (!currentById) {
        return state;
      }

      const nextById = patchOne(currentById, offerId, patch);
      if (nextById === currentById) {
        return state;
      }

      return {
        offersByRequestId: {
          ...state.offersByRequestId,
          [requestId]: nextById,
        },
      };
    });
  },
});

const createTransactionsSlice = (set: StoreSetter<AppStore>): TransactionsSlice => ({
  transactionsById: {},
  upsertTransactions: (transactions) => {
    set((state) => ({ transactionsById: upsertMany(state.transactionsById, transactions) }));
  },
  upsertTransaction: (transaction) => {
    set((state) => ({ transactionsById: upsertOne(state.transactionsById, transaction) }));
  },
  patchTransaction: (transactionId, patch) => {
    set((state) => ({
      transactionsById: patchOne(state.transactionsById, transactionId, patch),
    }));
  },
});

const createNotificationsSlice = (set: StoreSetter<AppStore>): NotificationsSlice => ({
  notificationsById: {},
  notificationsUnreadCount: 0,
  upsertNotifications: (notifications) => {
    set((state) => ({
      notificationsById: upsertMany(state.notificationsById, notifications),
    }));
  },
  upsertNotification: (notification) => {
    set((state) => ({
      notificationsById: upsertOne(state.notificationsById, notification),
    }));
  },
  patchNotification: (notificationId, patch) => {
    set((state) => ({
      notificationsById: patchOne(state.notificationsById, notificationId, patch),
    }));
  },
  removeNotification: (notificationId) => {
    set((state) => ({
      notificationsById: removeOne(state.notificationsById, notificationId),
    }));
  },
  setNotificationsUnreadCount: (count) => {
    set({ notificationsUnreadCount: Math.max(0, count) });
  },
});

const createProfileSlice = (set: StoreSetter<AppStore>): ProfileSlice => ({
  profile: null,
  setProfile: (profile) => {
    set({ profile });
  },
  patchProfile: (patch) => {
    set((state) => {
      if (!state.profile) {
        return state;
      }

      return {
        profile: {
          ...state.profile,
          ...patch,
        },
      };
    });
  },
});

export const useAppStore = create<AppStore>((set) => ({
  ...EMPTY_STATE,
  ...createProductsSlice(set),
  ...createRequestsSlice(set),
  ...createOffersSlice(set),
  ...createTransactionsSlice(set),
  ...createNotificationsSlice(set),
  ...createProfileSlice(set),
  reset: () => {
    set(EMPTY_STATE);
  },
}));

export const useAppDataStore = useAppStore;
