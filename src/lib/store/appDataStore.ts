import { create } from "zustand";
import type {
  ProductSummary,
  RequestOffer,
  RequestSummary,
  TransactionSummary,
} from "@barter/types";

type OfferById = Record<string, RequestOffer>;

interface AppDataState {
  productsById: Record<string, ProductSummary>;
  requestsById: Record<string, RequestSummary>;
  offersByRequestId: Record<string, OfferById>;
  transactionsById: Record<string, TransactionSummary>;
  upsertProducts: (products: ProductSummary[]) => void;
  upsertProduct: (product: ProductSummary) => void;
  removeProduct: (productId: string) => void;
  upsertRequests: (requests: RequestSummary[]) => void;
  upsertRequest: (request: RequestSummary) => void;
  upsertOffers: (requestId: string, offers: RequestOffer[]) => void;
  upsertTransactions: (transactions: TransactionSummary[]) => void;
  upsertTransaction: (transaction: TransactionSummary) => void;
  reset: () => void;
}

const EMPTY_STATE = {
  productsById: {},
  requestsById: {},
  offersByRequestId: {},
  transactionsById: {},
};

export const useAppDataStore = create<AppDataState>((set) => ({
  ...EMPTY_STATE,
  upsertProducts: (products) => {
    if (!products.length) return;
    set((state) => {
      const next = { ...state.productsById };
      for (const product of products) {
        next[product.id] = product;
      }
      return { productsById: next };
    });
  },
  upsertProduct: (product) => {
    set((state) => ({
      productsById: { ...state.productsById, [product.id]: product },
    }));
  },
  removeProduct: (productId) => {
    set((state) => {
      if (!state.productsById[productId]) return state;
      const next = { ...state.productsById };
      delete next[productId];
      return { productsById: next };
    });
  },
  upsertRequests: (requests) => {
    if (!requests.length) return;
    set((state) => {
      const next = { ...state.requestsById };
      for (const request of requests) {
        next[request.id] = request;
      }
      return { requestsById: next };
    });
  },
  upsertRequest: (request) => {
    set((state) => ({
      requestsById: { ...state.requestsById, [request.id]: request },
    }));
  },
  upsertOffers: (requestId, offers) => {
    set((state) => {
      const current = state.offersByRequestId[requestId] ?? {};
      const nextOffers: OfferById = { ...current };
      for (const offer of offers) {
        nextOffers[offer.id] = offer;
      }

      return {
        offersByRequestId: {
          ...state.offersByRequestId,
          [requestId]: nextOffers,
        },
      };
    });
  },
  upsertTransactions: (transactions) => {
    if (!transactions.length) return;
    set((state) => {
      const next = { ...state.transactionsById };
      for (const transaction of transactions) {
        next[transaction.id] = transaction;
      }
      return { transactionsById: next };
    });
  },
  upsertTransaction: (transaction) => {
    set((state) => ({
      transactionsById: { ...state.transactionsById, [transaction.id]: transaction },
    }));
  },
  reset: () => set({ ...EMPTY_STATE }),
}));
