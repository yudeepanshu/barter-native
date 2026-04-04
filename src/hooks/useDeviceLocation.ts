import { useCallback } from "react";
import { Platform } from "react-native";
// Static import — expo-location is always available in Expo Go and dev builds.
// Dynamic import() was hiding native module errors inside silent catch blocks.
import * as Location from "expo-location";
import {
  useDeviceLocationStore,
  type DeviceLocationSnapshot,
} from "@/lib/location/locationStore";

interface RequestLocationOptions {
  maxAccuracyMeters?: number;
}

function buildLocationName(
  placemark: {
    district?: string | null;
    subregion?: string | null;
    city?: string | null;
    region?: string | null;
    name?: string | null;
  } | null,
): string | undefined {
  if (!placemark) return undefined;
  const picked = [
    placemark.district,
    placemark.subregion,
    placemark.city,
    placemark.region,
    placemark.name,
  ]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
  return picked;
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

function hasRequiredAccuracy(
  accuracy: number | null | undefined,
  maxAccuracyMeters: number,
): boolean {
  return Number.isFinite(accuracy) && Number(accuracy) <= maxAccuracyMeters;
}

// Fetches the best available position.
// Strategy: precise cached fix first → high-accuracy fresh fix.
async function fetchPositionSnapshot(options?: RequestLocationOptions): Promise<DeviceLocationSnapshot> {
  const maxAccuracyMeters = options?.maxAccuracyMeters ?? 500;
  let coords: { latitude: number; longitude: number } | null = null;
  let accuracyMeters: number | undefined;

  // 1. Try last-known first when it already satisfies requested accuracy.
  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 120_000,
      requiredAccuracy: maxAccuracyMeters,
    });
    if (last && hasRequiredAccuracy(last.coords.accuracy, maxAccuracyMeters)) {
      coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
      accuracyMeters = last.coords.accuracy ?? undefined;
    }
  } catch {
    // No cached fix available
  }

  if (!coords) {
    // 2. Request a fresh high-accuracy fix.
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy:
          maxAccuracyMeters <= 50
            ? Location.Accuracy.Highest
            : Location.Accuracy.Balanced,
      });
      if (hasRequiredAccuracy(current.coords.accuracy, maxAccuracyMeters)) {
        coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        accuracyMeters = current.coords.accuracy ?? undefined;
      }
    } catch {
      // Leave as null and fail below.
    }
  }

  if (!coords) {
    throw new Error(`Unable to get location within ${maxAccuracyMeters}m accuracy.`);
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
    accuracyMeters,
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
  const requestLocation = useCallback(async (options?: RequestLocationOptions) => {
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
      const snapshot = await fetchPositionSnapshot(options);
      setLastKnown(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }, [setLastKnown, setPermission]);

  return { permission, lastKnown, requestLocation };
}
