import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";

function renderTabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function AppTabsLayout() {
  const { theme } = useAppTheme();

  return (
    <Tabs
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
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
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
