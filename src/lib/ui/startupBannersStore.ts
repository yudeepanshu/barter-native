import { create } from "zustand";

type BannerMode = 'full' | 'sheet';

type StartupBannersState = {
  visible: boolean;
  persistOnClose: boolean;
  mode: BannerMode;
  openId: number;
  open: (opts?: { persistOnClose?: boolean; mode?: BannerMode }) => void;
  close: () => void;
};

export const useStartupBannersStore = create<StartupBannersState>((set) => ({
  visible: false,
  persistOnClose: true,
  mode: 'sheet',
  openId: 0,
  open: (opts) => set((state) => ({
    visible: true,
    persistOnClose: opts?.persistOnClose ?? true,
    mode: opts?.mode ?? 'sheet',
    openId: state.openId + 1,
  })),
  close: () => set({ visible: false }),
}));
