import { create } from "zustand";

type StartupBannersState = {
  visible: boolean;
  persistOnClose: boolean;
  open: (opts?: { persistOnClose?: boolean }) => void;
  close: () => void;
};

export const useStartupBannersStore = create<StartupBannersState>((set) => ({
  visible: false,
  persistOnClose: true,
  open: (opts) => set({ visible: true, persistOnClose: opts?.persistOnClose ?? true }),
  close: () => set({ visible: false }),
}));
