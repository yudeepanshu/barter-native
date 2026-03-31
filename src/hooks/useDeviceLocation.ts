import { useCallback } from "react";
import { Platform } from "react-native";
// Static import — expo-location is always available in Expo Go and dev builds.
// Dynamic import() was hiding native module errors inside silent catch blocks.
import * as Location from "expo-location";
import {
  useDeviceLocationStore,
  type DeviceLocationSnapshot,
} from "@/lib/location/locationStore";

function buildLocationName(
  placemark: { city?: string | null; region?: string | null; country?: string | null } | null,
): string | undefined {
  if (!placemark) return undefined;
  const parts = [placemark.city, placemark.region, placemark.country]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  if (parts.length === 0) return undefined;
  return Array.from(new Set(parts)).join(", ");
}

export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number,
): Promise<string | undefined> {
  try {
    const canGeocode = await ensureGeocodingPermission();
    if (!canGeocode) {
      return undefined;
    }

    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    return buildLocationName(results[0] ?? null);
  } catch {
    return undefined;
  }
}

export async function ensureGeocodingPermission() {
  if (Platform.OS !== "android") {
    return true;
  }

  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

// Fetches the best available position.
// Strategy: last-known (instant, no GPS warm-up) → Accuracy.Low (cell/wifi, fast) → Accuracy.Balanced.
async function fetchPositionSnapshot(): Promise<DeviceLocationSnapshot> {
  let coords: { latitude: number; longitude: number } | null = null;

  // 1. Try last-known first (instant, zero battery cost)
  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 300_000,       // accept fixes up to 5 minutes old
      requiredAccuracy: 500, // within 500 m is fine for listing location
    });
    if (last) {
      coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
  } catch {
    // No cached fix available
  }

  if (!coords) {
    // 2. Accuracy.Low = cell tower / WiFi positioning, fast and works indoors without GPS
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
    } catch {
      // Cell/WiFi location unavailable, fall through to GPS
    }
  }

  if (!coords) {
    // 3. Full GPS fix as last resort
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
  }

  let locationName: string | undefined;
  try {
    const geocode = await Location.reverseGeocodeAsync(coords);
    locationName = buildLocationName(geocode[0] ?? null);
  } catch {
    locationName = undefined;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    locationName,
    capturedAt: Date.now(),
  };
}

export function useDeviceLocation() {
  const permission = useDeviceLocationStore((state) => state.permission);
  const lastKnown = useDeviceLocationStore((state) => state.lastKnown);
  const setPermission = useDeviceLocationStore((state) => state.setPermission);
  const setLastKnown = useDeviceLocationStore((state) => state.setLastKnown);

  // requestForegroundPermissionsAsync is idempotent: if already granted the OS resolves
  // it instantly without showing a dialog again.
  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === "granted";
    setPermission(granted ? "granted" : "denied");

    if (!granted) {
      setLastKnown(null);
      return null;
    }

    // Isolate GPS/hardware errors from the permission state — permission is fine,
    // so a position failure should NOT mark permission as denied.
    try {
      const snapshot = await fetchPositionSnapshot();
      setLastKnown(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }, [setLastKnown, setPermission]);

  return { permission, lastKnown, requestLocation };
}
