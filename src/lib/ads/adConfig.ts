import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const IS_DEV = process.env.EXPO_PUBLIC_APP_ENV === "dev";

const ADMOB_NATIVE_IDS = {
  android: {
    dev: TestIds.NATIVE,
    prod: "ca-app-pub-8970810504356168/5277037120",
  },
  ios: {
    dev: TestIds.NATIVE,
    prod: "PROD_IOS_AD_UNIT",
  },
};

export const NATIVE_AD_UNIT_ID =
  Platform.OS === "ios"
    ? IS_DEV ? ADMOB_NATIVE_IDS.ios.dev : ADMOB_NATIVE_IDS.ios.prod
    : IS_DEV ? ADMOB_NATIVE_IDS.android.dev : ADMOB_NATIVE_IDS.android.prod;

export const AD_EVERY_N_ITEMS = 6;
export const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED === "true";