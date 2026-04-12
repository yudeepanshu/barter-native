import { create } from "zustand";

type RequestToastScope = {
  type: "request";
  requestId: string;
  productId?: string;
};

type ProductToastScope = {
  type: "product";
  productId: string;
};

export type RealtimeToastScope = RequestToastScope | ProductToastScope | { type: "none" };

type RealtimeToastScopeState = {
  scope: RealtimeToastScope;
  setScope: (next: RealtimeToastScope) => void;
  clearScope: () => void;
};

export const useRealtimeToastScopeStore = create<RealtimeToastScopeState>((set) => ({
  scope: { type: "none" },
  setScope: (next) => set({ scope: next }),
  clearScope: () => set({ scope: { type: "none" } }),
}));
