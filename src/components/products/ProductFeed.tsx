import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { NotificationSummary, RequestStatus } from "@barter/types";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "@/hooks/mutations/useNotificationMutations";
import { useNotificationsQuery } from "@/hooks/queries/useNotificationsQuery";
import { useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useProductFeedFilters } from "@/hooks/useProductFeedFilters";
import { Input } from "@/components/ui/Input";
import { ProductCard } from "@/components/products/ProductCard";
import {
  ProductListEmptyState,
  ProductListErrorState,
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AppCard } from "@/components/ui/AppCard";

const REQUESTED_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING", "ACCEPTED"];

interface ProductFeedProps {
  userId: string;
  userName: string;
}

export function ProductFeed({ userId, userName }: ProductFeedProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const filterState = useProductFeedFilters({ limit: 20, excludeOwnerId: userId });
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const categoriesQuery = useCategoriesQuery();
  const products = useProductsListController(filterState.filters);
  const sentRequestsQuery = useRequestsQuery("sent", { limit: 100 });
  const notificationsQuery = useNotificationsQuery({ limit: 20 });
  const markNotificationReadMutation = useMarkNotificationReadMutation();
  const markAllNotificationsReadMutation = useMarkAllNotificationsReadMutation();

  const categories = categoriesQuery.data ?? [];
  const notifications = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [notificationsQuery.data],
  );
  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;
  const requestedProductIds = useMemo(() => {
    const items = sentRequestsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return new Set(
      items
        .filter((item) => REQUESTED_STATUSES.includes(item.status))
        .map((item) => item.productId),
    );
  }, [sentRequestsQuery.data]);

  const showInitialLoading = products.query.isPending && products.items.length === 0;
  const showInitialError = Boolean(products.query.error) && products.items.length === 0;

  useEffect(() => {
    if (!showInitialLoading) {
      setInitialLoadTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setInitialLoadTimedOut(true);
    }, 9000);

    return () => clearTimeout(timer);
  }, [showInitialLoading]);

  const onRefreshNotifications = async () => {
    await notificationsQuery.refetch();
  };

  const onOpenNotification = async (item: NotificationSummary) => {
    if (!item.isRead) {
      await markNotificationReadMutation.mutateAsync(item.id);
    }

    setShowNotifications(false);

    const payload = item.data ?? {};
    const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
    const productId = typeof payload.productId === "string" ? payload.productId : null;

    if (requestId) {
      router.push(`/(app)/requests/${requestId}`);
      return;
    }

    if (productId) {
      router.push(`/(app)/products/${productId}`);
    }
  };

  const onOpenNotificationsPanel = async () => {
    setShowNotifications(true);
    await notificationsQuery.refetch();
  };

  return (
    <>
      <FlatList
        data={products.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={products.query.isRefetching} onRefresh={products.refresh} />
        }
        onEndReachedThreshold={0.35}
        onEndReached={products.loadMore}
        ListHeaderComponent={
          <View style={styles.listHeaderWrap}>
            <AppCard>
              <View style={styles.greetingRow}>
                <View style={styles.greetingContent}>
                  <Text style={[styles.greeting, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                    Hello, {userName}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={2}>
                    Discover high-value listings near you
                  </Text>
                </View>

                <Pressable
                  onPress={() => void onOpenNotificationsPanel()}
                  style={[
                    styles.notificationBell,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Feather name="bell" size={18} color={theme.colors.textPrimary} />
                  {unreadCount > 0 ? (
                    <View style={[styles.notificationBadge, { backgroundColor: theme.colors.danger }]}>
                      <Text style={[styles.notificationBadgeText, { color: theme.colors.onPrimary }]}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>

              <Input
                label="Search listings"
                placeholder="Try bicycle, books, guitar..."
                value={filterState.search}
                onChangeText={filterState.setSearch}
              />
              {filterState.isSearchDebouncing ? (
                <Text style={[styles.searchHint, { color: theme.colors.textMuted }]}>Updating results...</Text>
              ) : null}

              <View>
                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Categories</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <CategoryChip
                    active={filterState.categoryId === ""}
                    label="All"
                    onPress={() => filterState.setCategoryId("")}
                  />
                  {categories.map((category) => (
                    <CategoryChip
                      key={category.id}
                      active={filterState.categoryId === category.id}
                      label={category.name}
                      onPress={() => filterState.setCategoryId(category.id)}
                    />
                  ))}
                </ScrollView>
              </View>

              {products.isEmpty && !showInitialLoading && !showInitialError ? (
                <ProductListEmptyState message="No listings found for the current filters." />
              ) : null}
            </AppCard>
          </View>
        }
        ListEmptyComponent={
          showInitialLoading ? (
            initialLoadTimedOut ? (
              <ProductListErrorState
                message="Loading is taking longer than expected. Check your connection and retry."
                onRetry={products.refresh}
              />
            ) : (
              <ProductListLoadingState spinnerSize={30} />
            )
          ) : showInitialError ? (
            <ProductListErrorState
              message="Could not load listings. Please try again."
              onRetry={products.refresh}
            />
          ) : null
        }
        ListFooterComponent={
          products.query.isFetchingNextPage ? <ProductListFooterLoadingState /> : null
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => {
              router.push(`/(app)/products/${item.id}`);
            }}
            showMeta
            isRequested={requestedProductIds.has(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable
          style={[styles.notificationsBackdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setShowNotifications(false)}
        >
          <Pressable
            style={[
              styles.notificationsPanel,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={() => {
              // Keep panel open when tapping inside.
            }}
          >
            <View style={styles.notificationsHeaderRow}>
              <Text style={[styles.notificationsTitle, { color: theme.colors.textPrimary }]}>Notifications</Text>
              <View style={styles.notificationsActionsRow}>
                <Pressable
                  onPress={() => void onRefreshNotifications()}
                  disabled={notificationsQuery.isFetching}
                  style={styles.notificationsIconAction}
                >
                  {notificationsQuery.isFetching ? (
                    <ActivityIndicator size={14} color={theme.colors.textSecondary} />
                  ) : (
                    <Feather name="refresh-cw" size={15} color={theme.colors.textSecondary} />
                  )}
                </Pressable>

                <Pressable
                  onPress={() => void markAllNotificationsReadMutation.mutateAsync()}
                  disabled={unreadCount === 0 || markAllNotificationsReadMutation.isPending}
                >
                  <Text style={[styles.notificationsActionText, { color: theme.colors.textSecondary }]}>Mark all read</Text>
                </Pressable>
              </View>
            </View>

            {notificationsQuery.isFetching && notifications.length === 0 ? (
              <View style={styles.notificationsLoadingWrap}>
                <ActivityIndicator size={20} color={theme.colors.primary} />
              </View>
            ) : notifications.length === 0 ? (
              <Text style={[styles.notificationsEmpty, { color: theme.colors.textMuted }]}>No updates yet.</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.notificationsList}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => void onOpenNotification(item)}
                    style={[
                      styles.notificationItem,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: item.isRead ? theme.colors.surface : theme.colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Text style={[styles.notificationItemTitle, { color: theme.colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.notificationItemBody, { color: theme.colors.textSecondary }]}>{item.body}</Text>
                    <Text style={[styles.notificationItemMeta, { color: theme.colors.textMuted }]}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                onEndReachedThreshold={0.3}
                onEndReached={() => {
                  if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
                    void notificationsQuery.fetchNextPage();
                  }
                }}
                ListFooterComponent={
                  notificationsQuery.isFetchingNextPage ? (
                    <View style={styles.notificationsLoadingWrap}>
                      <ActivityIndicator size={16} color={theme.colors.primary} />
                    </View>
                  ) : null
                }
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.colors.chipActiveBg : theme.colors.border,
          backgroundColor: active ? theme.colors.chipActiveBg : theme.colors.chipBg,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: active ? theme.colors.chipActiveText : theme.colors.chipText }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 108, gap: 2 },
  listHeaderWrap: { marginBottom: 10 },
  headerSection: {
    gap: 14,
    marginBottom: 12,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  greetingContent: { flexGrow: 1, flexShrink: 1, minWidth: 180, paddingRight: 2 },
  notificationBell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  greeting: { fontSize: 24, lineHeight: 29, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 3 },
  searchHint: { fontSize: 12, marginTop: -4 },
  sectionLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    maxWidth: 160,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  notificationsBackdrop: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 96,
    paddingBottom: 24,
  },
  notificationsPanel: {
    borderWidth: 1,
    borderRadius: 14,
    maxHeight: "76%",
    padding: 12,
    gap: 10,
  },
  notificationsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationsActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationsIconAction: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationsTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  notificationsActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  notificationsList: {
    paddingBottom: 6,
  },
  notificationsLoadingWrap: {
    paddingVertical: 14,
    alignItems: "center",
  },
  notificationsEmpty: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 14,
  },
  notificationItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  notificationItemTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  notificationItemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  notificationItemMeta: {
    fontSize: 11,
  },
});
