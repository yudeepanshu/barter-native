import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="complete-profile" options={{ title: "Complete Profile", headerShown: false }} />
      <Stack.Screen name="products/[id]" options={{ title: "Product", headerShown: false }} />
      <Stack.Screen
        name="listings/[id]/edit"
        options={{ title: "Edit Listing", headerShown: false }}
      />
      <Stack.Screen name="requests/[id]" options={{ title: "Request", headerShown: false }} />
    </Stack>
  );
}
