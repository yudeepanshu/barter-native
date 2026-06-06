import { useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProductSummary } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ProductQueriesTab } from "./ProductQueriesTab";
import { ProductDetailsTab } from "./ProductDetailsTab";

type TabKey = "details" | "queries";

interface TabLayout {
  x: number;
  width: number;
}

interface ProductDetailTabsProps {
  product: ProductSummary;
  isOwner: boolean;
  sessionUserId?: string;
  isLoading?: boolean;
}

export function ProductDetailTabs({
  product,
  isOwner,
  sessionUserId,
  isLoading,
}: ProductDetailTabsProps) {
  const { theme } = useAppTheme();

  const initialQueries = product.latestQueries?.items ?? [];
  const initialNextCursor = product.latestQueries?.nextCursor ?? null;

  const hasAdditionalDetails = true;

  const tabsAvailable: TabKey[] = [
    ...(hasAdditionalDetails ? (["details"] as TabKey[]) : []),
    "queries",
  ];

  const [activeTab, setActiveTab] = useState<TabKey>(tabsAvailable[0] ?? "queries");

  // ── Animated sliding indicator ──────────────────────────────────────────────
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef<Partial<Record<TabKey, TabLayout>>>({});

  const animateIndicatorTo = (tab: TabKey) => {
    const layout = tabLayouts.current[tab];
    if (!layout) return;
    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: layout.x,
        useNativeDriver: false,
        tension: 280,
        friction: 28,
      }),
      Animated.spring(indicatorWidth, {
        toValue: layout.width,
        useNativeDriver: false,
        tension: 280,
        friction: 28,
      }),
    ]).start();
  };

  const handleTabLayout = (tab: TabKey) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    tabLayouts.current[tab] = { x, width };
    if (tab === activeTab) {
      indicatorX.setValue(x);
      indicatorWidth.setValue(width);
    }
  };

  const handleTabPress = (tab: TabKey) => {
    setActiveTab(tab);
    animateIndicatorTo(tab);
  };

  const queryCount = initialQueries.length;
  const hasMore = Boolean(initialNextCursor);
  const showTabBar = tabsAvailable.length > 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      {showTabBar ? (
        <View style={[styles.tabBarWrap, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.tabBar}>
            {tabsAvailable.map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === "details" ? "Details" : "Queries";
              return (
                <Pressable
                  key={tab}
                  onPress={() => handleTabPress(tab)}
                  onLayout={handleTabLayout(tab)}
                  style={styles.tabItem}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive ? theme.colors.textPrimary : theme.colors.textMuted,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                  {tab === "queries" && queryCount > 0 ? (
                    <View
                      style={[
                        styles.tabBadge,
                        {
                          backgroundColor: isActive
                            ? theme.colors.primary
                            : theme.colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabBadgeText,
                          { color: /* isActive ? theme.colors.textSecondary : */ theme.colors.textMuted },
                        ]}
                      >
                        {hasMore ? `${queryCount}+` : String(queryCount)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Animated sliding underline */}
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor: theme.colors.primary,
                left: indicatorX,
                width: indicatorWidth,
              },
            ]}
          />
        </View>
      ) : (
        /* ── Single-tab header ─────────────────────────────────────────────── */
        <View style={[styles.singleTabHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.singleTabTitle, { color: theme.colors.textPrimary }]}>
            Queries
          </Text>
          {queryCount > 0 ? (
            <View style={[styles.tabBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.tabBadgeText, { color: theme.colors.textMuted }]}>
                {hasMore ? `${queryCount}+` : String(queryCount)}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <View style={styles.tabContent}>
        {activeTab === "details" ? (
          <ProductDetailsTab product={product} isOwner={isOwner} isLoading={isLoading} />
        ) : (
          <ProductQueriesTab
            productId={product.id}
            isOwner={isOwner}
            sessionUserId={sessionUserId}
            initialQueries={initialQueries}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  tabBarWrap: {
    borderBottomWidth: 1,
    position: "relative",
  },
  tabBar: {
    flexDirection: "row",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
  tabLabel: { fontSize: 13 },
  tabBadge: {
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: { fontSize: 10, fontWeight: "700" },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    borderRadius: 2,
  },
  singleTabHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  singleTabTitle: { fontSize: 15, fontWeight: "700" },
  tabContent: { padding: 14 },
});