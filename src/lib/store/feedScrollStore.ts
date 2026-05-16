import { create } from "zustand";

interface FeedScrollState {
    tabBarVisible: boolean;
    setTabBarVisible: (visible: boolean) => void;
}

export const useFeedScrollStore = create<FeedScrollState>((set) => ({
    tabBarVisible: true,
    setTabBarVisible: (visible) => set({ tabBarVisible: visible }),
}));