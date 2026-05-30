import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.EXPO_PUBLIC_APP_ENV === "dev";

export default (): ExpoConfig => ({
  name: "Flippe",
  slug: "flippe",
  version: "0.2.3-alpha.0",
  scheme: "flippe",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#133A92",
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Flippe uses your location to auto-fill listing location details and show nearby listings.",
    },
    bundleIdentifier: "com.shinichi.flippeapp",
  },
  android: {
    package: "com.shinichi.flippeapp",
    versionCode: 60,
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#133A92",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "@react-native-google-signin/google-signin",
    "expo-secure-store",
    "expo-image-picker",
    "expo-notifications",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Flippe uses your location to auto-fill listing details and improve nearby feed results.",
      },
    ],
    "expo-image",
    "expo-system-ui",
    [
      "expo-build-properties",
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          softwareKeyboardLayoutMode: "resize",
        },
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: IS_DEV
          ? "ca-app-pub-8970810504356168~5016200136"  // your dev Android app ID
          : "ca-app-pub-8970810504356168~2581608484",                    // replace when you create prod
        iosAppId: IS_DEV
          ? "DEV_IOS_APP_ID"                          // replace when you create iOS dev
          : "PROD_IOS_APP_ID",                        // replace when you create iOS prod
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "2b766fb2-959d-4319-8bae-ada580beeb29",
    },
  },
});