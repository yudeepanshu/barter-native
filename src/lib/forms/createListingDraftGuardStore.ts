import { create } from "zustand";

interface CreateListingDraftGuardState {
  hasUnsavedChanges: boolean;
  resetDraft: (() => void) | null;
  setHasUnsavedChanges: (value: boolean) => void;
  setResetDraft: (handler: (() => void) | null) => void;
}

export const useCreateListingDraftGuardStore = create<CreateListingDraftGuardState>((set) => ({
  hasUnsavedChanges: false,
  resetDraft: null,
  setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),
  setResetDraft: (handler) => set({ resetDraft: handler }),
}));
