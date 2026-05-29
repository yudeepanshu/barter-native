// supportOptionsStore.ts
import { SupportOption } from "@barter/types";
import { create } from "zustand";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SupportOptionsState {
  options: SupportOption[];
  loaded: boolean;
  lastFetchedAt: number | null;
  setSupportOptions: (options: SupportOption[]) => void;
}

export const useSupportOptionsStore = create<SupportOptionsState>((set) => ({
  options: [],
  loaded: false,
  lastFetchedAt: null,
  setSupportOptions: (options) =>
    set({ options, loaded: true, lastFetchedAt: Date.now() }),
}));