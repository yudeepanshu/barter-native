import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { View, Animated } from "react-native";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCreateListingDraftGuardStore } from "@/lib/forms/createListingDraftGuardStore";
import {
  checkProductCreationLimit,
  getProductCreationLimitMessage,
  MAX_PRODUCTS_PER_USER,
} from "@/lib/listings/productCreationLimit";
import { queryClient } from "@/lib/query/queryClient";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { useFeedScrollStore } from "@/lib/store/feedScrollStore";
import { Spinner } from "@/components/ui/Spinner";

const tabBarBottomPadding = Math.max(initialWindowMetrics!.insets.bottom, 10);
const tabBarHeight = 58 + tabBarBottomPadding;

function renderTabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

function CreateTabIcon({
  color,
  size,
  isChecking,
}: {
  color: string;
  size: number;
  isChecking: boolean;
}) {
  if (isChecking) {
    // Wrap in a fixed-size View matching the icon frame so the tab layout
    // doesn't shift when switching between icon and spinner.
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Spinner size={size - 6} />
      </View>
    );
  }
  return <Ionicons name="add-circle-outline" size={size} color={color} />;
}

export default function AppTabsLayout() {
  const { theme } = useAppTheme();
  const session = useSession();
  const hasUnsavedCreateDraft = useCreateListingDraftGuardStore((state) => state.hasUnsavedChanges);
  const resetCreateDraft = useCreateListingDraftGuardStore((state) => state.resetDraft);
  const tabBarVisible = useFeedScrollStore((state) => state.tabBarVisible);
  const dialog = useAppDialog();
  const createCheckInFlightRef = useRef(false);
  const [isCheckingCreateLimit, setIsCheckingCreateLimit] = useState(false);

  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(tabBarTranslateY, {
      toValue: tabBarVisible ? 0 : tabBarHeight,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [tabBarVisible, tabBarTranslateY]);

  return (
    <Tabs
      screenListeners={({ navigation, route }) => ({
        tabPress: (event) => {
          const state = navigation.getState();
          const currentRouteName = state.routes[state.index]?.name;
          const leavingCreateTab = currentRouteName === "create" && route.name !== "create";
          const openingCreateTab = currentRouteName !== "create" && route.name === "create";

          if (openingCreateTab) {
            event.preventDefault();

            if (createCheckInFlightRef.current) return;
            createCheckInFlightRef.current = true;
            setIsCheckingCreateLimit(true);
            const routeAtTapTime = navigation.getState().routes[navigation.getState().index]?.name;

            void (async () => {
              try {
                const userId = session?.user.id;

                if (!userId) {
                  setIsCheckingCreateLimit(false);
                  navigation.navigate("create");
                  return;
                }

                const atLimit = await checkProductCreationLimit(queryClient, userId);

                // User navigated away while check was in flight — abort silently.
                const currentRoute = navigation.getState().routes[navigation.getState().index]?.name;
                if (currentRoute !== routeAtTapTime) return;

                // Clear spinner immediately before any visible outcome so it doesn't
                // linger while the create screen mounts or the dialog animates in.
                setIsCheckingCreateLimit(false);

                if (!atLimit) {
                  navigation.navigate("create");
                  return;
                }

                const action = await dialog.show({
                  title: "Limit reached",
                  message: getProductCreationLimitMessage(MAX_PRODUCTS_PER_USER),
                  actions: [{ key: "see-listings", label: "See current listings" }],
                  dismissOnBackdrop: true,
                });

                if (action === "see-listings" && route.name !== "my-listings") {
                  navigation.navigate("my-listings");
                }
              } catch {
                const currentRoute = navigation.getState().routes[navigation.getState().index]?.name;
                if (currentRoute === routeAtTapTime) {
                  navigation.navigate("create");
                }
              } finally {
                createCheckInFlightRef.current = false;
                setIsCheckingCreateLimit(false);
              }
            })();

            return;
          }

          if (!leavingCreateTab || !hasUnsavedCreateDraft) {
            return;
          }

          event.preventDefault();
          void (async () => {
            const shouldDiscard = await dialog.confirm(
              "Discard draft?",
              "You have unsaved listing details. Keep editing or discard them?",
              {
                cancelLabel: "Keep editing",
                confirmLabel: "Discard",
                destructive: true,
              },
            );

            if (shouldDiscard) {
              resetCreateDraft?.();
              navigation.navigate(route.name);
            }
          })();
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          paddingBottom: 2,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 2,
        },
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.backgroundElevated,
          position: "absolute",
          transform: [{ translateY: tabBarTranslateY }],
          bottom: 0,
          left: 0,
          right: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Feed", tabBarIcon: renderTabIcon("home-outline") }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: renderTabIcon("swap-horizontal-outline"),
          sceneStyle: { paddingBottom: tabBarHeight },
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ color, size }) => (
            <CreateTabIcon color={color} size={size} isChecking={isCheckingCreateLimit} />
          ),
          sceneStyle: { paddingBottom: tabBarHeight },
        }}
      />
      <Tabs.Screen
        name="my-listings"
        options={{
          title: "My Listings",
          tabBarIcon: renderTabIcon("pricetag-outline"),
          sceneStyle: { paddingBottom: tabBarHeight },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: renderTabIcon("person-outline") }}
      />
    </Tabs>
  );
}