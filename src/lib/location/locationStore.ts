import { create } from "zustand";

export type DeviceLocationPermission = "undetermined" | "granted" | "denied";

export interface DeviceLocationSnapshot {
  latitude: number;
  longitude: number;
  locationName?: string;
  capturedAt: number;
}

interface DeviceLocationState {
  permission: DeviceLocationPermission;
  lastKnown: DeviceLocationSnapshot | null;
  setPermission: (permission: DeviceLocationPermission) => void;
  setLastKnown: (snapshot: DeviceLocationSnapshot | null) => void;
}

export const useDeviceLocationStore = create<DeviceLocationState>((set) => ({
  permission: "undetermined",
  lastKnown: null,
  setPermission: (permission) => set({ permission }),
  setLastKnown: (lastKnown) => set({ lastKnown }),
}));
