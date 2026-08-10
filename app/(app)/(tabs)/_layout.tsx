import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Animated,
  Pressable,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
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

import type { ViewStyle, StyleProp } from "react-native";

// 👇 adjust this to change how long the ripple animation takes
const RIPPLE_DURATION_MS = 500;
const RIPPLE_ORIGIN_Y_RATIO = 0.4;
const RIPPLE_OVERFLOW_PADDING = 12;

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
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Spinner size={size - 6} />
      </View>
    );
  }
  return <Ionicons name="add-circle-outline" size={size} color={color} />;
}

type RippleTabBarButtonProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  rippleColor?: string;
  rippleDuration?: number;
} & Record<string, unknown>;

function RippleTabBarButton({
  children,
  style,
  onPress,
  onLongPress,
  rippleColor = "#000000",
  rippleDuration = RIPPLE_DURATION_MS,
  ...rest
}: RippleTabBarButtonProps) {
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const layoutRef = useRef({ width: 0, height: 0 });
  const rippleKeyRef = useRef(0);
  const [ripple, setRipple] = useState<{
    x: number;
    y: number;
    size: number;
    key: number;
  } | null>(null);

  const triggerRipple = (locationX: number, locationY: number) => {
    const { width, height } = layoutRef.current;
    // size the circle so it always covers the whole button from wherever it was tapped
    const maxDistX = Math.max(locationX, width - locationX);
    const maxDistY = Math.max(locationY, height - locationY);
    const radius = Math.sqrt(maxDistX ** 2 + maxDistY ** 2) || 1;
    const size = radius * 2;

    rippleKeyRef.current += 1;
    setRipple({ x: locationX - radius, y: locationY - radius, size, key: rippleKeyRef.current });

    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: rippleDuration,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRipple(null);
    });
  };

  const handlePressIn = () => {
    const { width, height } = layoutRef.current;
    const originX = width / 2;
    const originY = height * RIPPLE_ORIGIN_Y_RATIO;
    triggerRipple(originX, originY);
  };

  const scale = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const opacity = rippleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.28, 0.16, 0] });

return (
  <Pressable
    {...rest}
    onPress={onPress}
    onLongPress={onLongPress}
    onPressIn={handlePressIn}
    onLayout={(event) => {
      const { width, height } = event.nativeEvent.layout;
      layoutRef.current = { width, height };
    }}
    style={style}
  >
    <View
      pointerEvents="none"
      style={[
        styles.rippleClipLayer,
        { top: -RIPPLE_OVERFLOW_PADDING, bottom: -RIPPLE_OVERFLOW_PADDING },
      ]}
    >
      {ripple && (
        <Animated.View
          key={ripple.key}
          style={[
            styles.ripple,
            {
              left: ripple.x,
              top: ripple.y + RIPPLE_OVERFLOW_PADDING, // shift down to match the layer's offset
              width: ripple.size,
              height: ripple.size,
              borderRadius: ripple.size / 2,
              backgroundColor: rippleColor,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />
      )}
    </View>
    {children}
  </Pressable>
);
}

const styles = StyleSheet.create({
  rippleClipLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  ripple: {
    position: "absolute",
  },
});

export default function AppTabsLayout() {
  const { theme } = useAppTheme();
  const session = useSession();
  const hasUnsavedCreateDraft = useCreateListingDraftGuardStore((state) => state.hasUnsavedChanges);
  const resetCreateDraft = useCreateListingDraftGuardStore((state) => state.resetDraft);
  const tabBarVisible = useFeedScrollStore((state) => state.tabBarVisible);
  const dialog = useAppDialog();
  const createCheckInFlightRef = useRef(false);
  const [isCheckingCreateLimit, setIsCheckingCreateLimit] = useState(false);

  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom, 10);
  const tabBarHeight = 58 + tabBarBottomPadding;

  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(tabBarTranslateY, {
      toValue: tabBarVisible ? 0 : tabBarHeight,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [tabBarVisible, tabBarTranslateY, tabBarHeight]);

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

                const currentRoute = navigation.getState().routes[navigation.getState().index]?.name;
                if (currentRoute !== routeAtTapTime) return;

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
        tabBarButton: (props) => (
          <RippleTabBarButton
            {...props}
            rippleColor={theme.colors.textPrimary}
            rippleDuration={RIPPLE_DURATION_MS}
          />
        ),
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