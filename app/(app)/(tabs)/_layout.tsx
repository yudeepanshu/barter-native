import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSession } from "@/hooks/useSession";
import {
  MAX_PRODUCTS_PER_USER,
  getProductCreationLimitMessage,
  hasReachedProductCreationLimit,
} from "@/lib/listings/productCreationLimit";
import { useCreateListingDraftGuardStore } from "@/lib/forms/createListingDraftGuardStore";
import { useAppDialog } from "@/providers/AppDialogProvider";

function renderTabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function AppTabsLayout() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const hasUnsavedCreateDraft = useCreateListingDraftGuardStore((state) => state.hasUnsavedChanges);
  const resetCreateDraft = useCreateListingDraftGuardStore((state) => state.resetDraft);
  const dialog = useAppDialog();
  const tabBarBottomPadding = Math.max(insets.bottom, 10);
  const tabBarHeight = 58 + tabBarBottomPadding;

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
            void (async () => {
              try {
                const userId = session?.user.id;
                const atLimit = userId ? await hasReachedProductCreationLimit(userId) : false;
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

                if (action === "see-listings") {
                  navigation.navigate("my-listings");
                }
              } catch {
                navigation.navigate("create");
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
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Feed", tabBarIcon: renderTabIcon("home-outline") }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: "Requests", tabBarIcon: renderTabIcon("swap-horizontal-outline") }}
      />
      <Tabs.Screen
        name="create"
        options={{ title: "Create", tabBarIcon: renderTabIcon("add-circle-outline") }}
      />
      <Tabs.Screen
        name="my-listings"
        options={{ title: "My Listings", tabBarIcon: renderTabIcon("pricetag-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: renderTabIcon("person-outline") }}
      />
    </Tabs>
  );
}
