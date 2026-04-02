import { Platform } from "react-native";
import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";

let notificationsModulePromise: Promise<typeof ExpoNotifications | null> | null = null;
let notificationHandlerConfigured = false;

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
      return null;
    }

    await ensureNotificationHandlerConfigured(notifications);
    await ensureAndroidChannelConfigured(notifications);

    if (
      typeof notifications.getPermissionsAsync !== "function" ||
      typeof notifications.requestPermissionsAsync !== "function" ||
      typeof notifications.getExpoPushTokenAsync !== "function"
    ) {
      return null;
    }

    const { status: existingStatus } = await notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const permissionResponse = await notifications.requestPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      return null;
    }

    const tokenResponse = await notifications.getExpoPushTokenAsync({ projectId });
    return typeof tokenResponse.data === "string" ? tokenResponse.data : null;
  } catch {
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