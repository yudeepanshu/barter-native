import { create } from "zustand";
import type { ImagePickerAsset } from "expo-image-picker";

interface ListingImagePreparationEntry {
  localPreviewUri: string | null;
  phase: 'uploading' | 'activating' | 'failed';
  retryAssets: ImagePickerAsset[];
}

interface ListingImagePreparationState {
  pendingByProductId: Record<string, ListingImagePreparationEntry>;
  markPreparing: (
    productId: string,
    localPreviewUri?: string | null,
    retryAssets?: ImagePickerAsset[],
  ) => void;
  markActivating: (productId: string) => void;
  markFailed: (productId: string) => void;
  clearPreparing: (productId: string) => void;
}

export const useListingImagePreparationStore = create<ListingImagePreparationState>((set) => ({
  pendingByProductId: {},
  markPreparing: (productId, localPreviewUri = null, retryAssets = []) =>
    set((state) => ({
      pendingByProductId: {
        ...state.pendingByProductId,
        [productId]: {
          localPreviewUri,
          phase: 'uploading',
          retryAssets,
        },
      },
    })),
  markActivating: (productId) =>
    set((state) => {
      const existing = state.pendingByProductId[productId];
      if (!existing) {
        return state;
      }

      return {
        pendingByProductId: {
          ...state.pendingByProductId,
          [productId]: {
            ...existing,
            phase: 'activating',
          },
        },
      };
    }),
  markFailed: (productId) =>
    set((state) => {
      const existing = state.pendingByProductId[productId];
      if (!existing) {
        return state;
      }

      return {
        pendingByProductId: {
          ...state.pendingByProductId,
          [productId]: {
            ...existing,
            phase: 'failed',
          },
        },
      };
    }),
  clearPreparing: (productId) =>
    set((state) => {
      if (!state.pendingByProductId[productId]) {
        return state;
      }

      const nextPendingByProductId = { ...state.pendingByProductId };
      delete nextPendingByProductId[productId];

      return { pendingByProductId: nextPendingByProductId };
    }),
}));