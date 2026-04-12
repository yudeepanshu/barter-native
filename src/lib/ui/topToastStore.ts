import { create } from "zustand";

export type TopToastVariant = "info" | "success" | "warning";

export type TopToastMessage = {
  id: string;
  title: string;
  message?: string;
  variant: TopToastVariant;
  durationMs: number;
};

type TopToastInput = {
  title: string;
  message?: string;
  variant?: TopToastVariant;
  durationMs?: number;
};

type TopToastState = {
  queue: TopToastMessage[];
  enqueueToast: (input: TopToastInput) => void;
  shiftToast: () => void;
  clearToasts: () => void;
};

const DEFAULT_DURATION_MS = 2600;

function nextToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useTopToastStore = create<TopToastState>((set) => ({
  queue: [],
  enqueueToast: (input) => {
    const nextToast: TopToastMessage = {
      id: nextToastId(),
      title: input.title,
      ...(input.message ? { message: input.message } : {}),
      variant: input.variant ?? "info",
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
    };

    set((state) => ({
      queue: [...state.queue, nextToast],
    }));
  },
  shiftToast: () => {
    set((state) => ({
      queue: state.queue.slice(1),
    }));
  },
  clearToasts: () => {
    set({ queue: [] });
  },
}));
