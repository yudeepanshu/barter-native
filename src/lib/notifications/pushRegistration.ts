import { Platform } from "react-native";
import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";

let notificationsModulePromise: Promise<typeof ExpoNotifications | null> | null = null;
let notificationHandlerConfigured = false;

function logPushRegistration(message: string, meta?: Record<string, unknown>) {
  if (!__DEV__) {
    return;
  }

  console.warn(`[push-registration] ${message}`, meta ?? "");
}

async function loadNotificationsModule() {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then((module) => module)
      .catch(() => null);
  }

  return notificationsModulePromise;
}

async function ensureNotificationHandlerConfigured(notifications: typeof ExpoNotifications) {
  if (notificationHandlerConfigured || typeof notifications.setNotificationHandler !== "function") {
    return;
  }

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationHandlerConfigured = true;
}

async function ensureAndroidChannelConfigured(notifications: typeof ExpoNotifications) {
  if (
    Platform.OS !== "android" ||
    typeof notifications.setNotificationChannelAsync !== "function"
  ) {
    return;
  }

  await notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2C7CFF",
  });
}

function getProjectId() {
  const projectIdFromEas = Constants.easConfig?.projectId;
  if (typeof projectIdFromEas === "string" && projectIdFromEas.length > 0) {
    return projectIdFromEas;
  }

  const projectIdFromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectIdFromExpoConfig === "string" && projectIdFromExpoConfig.length > 0) {
    return projectIdFromExpoConfig;
  }

  return null;
}

export async function getExpoPushTokenForDevice() {
  try {
    const notifications = await loadNotificationsModule();
    if (!notifications) {
      logPushRegistration("expo-notifications module unavailable");
      return null;
    }

    await ensureNotificationHandlerConfigured(notifications);
    await ensureAndroidChannelConfigured(notifications);

    if (
      typeof notifications.getPermissionsAsync !== "function" ||
      typeof notifications.requestPermissionsAsync !== "function" ||
      typeof notifications.getExpoPushTokenAsync !== "function"
    ) {
      logPushRegistration("notifications API unavailable on this build");
      return null;
    }

    const { status: existingStatus } = await notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const permissionResponse = await notifications.requestPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    if (finalStatus !== "granted") {
      logPushRegistration("notification permission not granted", { finalStatus });
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      logPushRegistration("missing EAS projectId for Expo push token lookup");
      return null;
    }

    const tokenResponse = await notifications.getExpoPushTokenAsync({ projectId });
    const token = typeof tokenResponse.data === "string" ? tokenResponse.data : null;
    if (!token) {
      logPushRegistration("Expo returned an empty push token");
    }
    return token;
  } catch (error) {
    logPushRegistration("failed to get Expo push token", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function getLastNotificationResponse() {
  const notifications = await loadNotificationsModule();
  if (!notifications || typeof notifications.getLastNotificationResponseAsync !== "function") {
    return null;
  }

  return notifications.getLastNotificationResponseAsync();
}

export async function addNotificationResponseReceivedListener(
  listener: (response: ExpoNotifications.NotificationResponse) => void,
) {
  const notifications = await loadNotificationsModule();
  if (!notifications || typeof notifications.addNotificationResponseReceivedListener !== "function") {
    return () => {};
  }

  const subscription = notifications.addNotificationResponseReceivedListener(listener);
  return () => {
    subscription.remove();
  };
}