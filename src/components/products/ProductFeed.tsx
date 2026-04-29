import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import type { NotificationSummary, ProductSummary, RequestStatus } from "@barter/types";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useClearAllNotificationsMutation,
} from "@/hooks/mutations/useNotificationMutations";
import { useNotificationsQuery } from "@/hooks/queries/useNotificationsQuery";
import { REQUESTS_SENT_MATCH_LIMIT, useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { useProductFeedFilters } from "@/hooks/useProductFeedFilters";
import { Input } from "@/components/ui/Input";
import { ProductCard } from "@/components/products/ProductCard";
import {
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CollapsibleHeaderCard } from "@/components/ui/CollapsibleHeaderCard";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { FilterChip } from "@/components/filters/FilterChip";
import { CategoryMultiSelectChips } from "@/components/filters/CategoryMultiSelectChips";
import { ListControlsRow } from "@/components/filters/ListControlsRow";
import { RangeSlider } from "../filters/RangeSlider";
import { SortBottomSheet, type SortOrder } from "@/components/filters/SortBottomSheet";
import { writeStartupFeedSnapshot } from "@/lib/feed/feedSnapshotCache";
import { getFirstName } from "@/lib/utils/commonUtils";
import { ErrorView } from "../ui/ErrorView";
import { EmptyView } from "../ui/EmptyView";

const REQUESTED_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING", "ACCEPTED"];
const MIN_PROXIMITY_KM = 2;
const MAX_PROXIMITY_KM = 100;
const DEFAULT_NEAREST_RADIUS_KM = 10;
const LOCATION_RECALCULATE_THRESHOLD_KM = 5;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

interface FeedHeaderCardProps {
  userName: string;
  filterState: {
    search: string;
    setSearch: (value: string) => void;
    isSearchDebouncing: boolean;
    proximity: { latitude: number; longitude: number; radiusKm: number } | null;
  };
  activeFilterCount: number;
  freeOnly: boolean;
  onToggleFree: () => void;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  productCount: number;
  onOpenNotificationsPanel: () => void;
  unreadCount: number;
  isBackgroundRefreshing: boolean;
}

function FeedHeaderCard({
  userName,
  filterState,
  activeFilterCount,
  freeOnly,
  onToggleFree,
  onOpenFilters,
  onOpenSort,
  productCount,
  onOpenNotificationsPanel,
  unreadCount,
  isBackgroundRefreshing,
}: FeedHeaderCardProps) {
  const { theme } = useAppTheme();

  const firstName = useMemo(() => {
    return getFirstName(userName);
  }, [userName]);

  return (
    <CollapsibleHeaderCard
      title={`Hello, ${firstName}`}
      subtitle="Discover listings near you"
      defaultExpanded={true}
      subtitleRight={
        isBackgroundRefreshing || filterState.isSearchDebouncing ? (
          <ActivityIndicator size={12} color={theme.colors.textMuted} />
        ) : null
      }
      rightActions={
        <Pressable
          onPress={() => void onOpenNotificationsPanel()}
          style={[
            styles.notificationBell,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
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
      }
      collapseMaxHeight={320}
      collapseDurationMs={160}
      footerSlot={
        <View style={styles.headerMetaRow}>
          <View style={[
            styles.headerMetaCounterPill,
          ]}>
            <Text style={[styles.headerMetaCountText, { color: theme.colors.textPrimary }]}>
              {productCount}
            </Text>
            <Text style={[styles.headerMetaCountLabel, { color: theme.colors.textMuted }]}>
              {(productCount === 1 || productCount === 0) ? "listing" : "listings"}
            </Text>
          </View>
          <View style={styles.headerMetaSummaryContainer}>
            {filterState.proximity?.radiusKm ? (
              <Feather name="map-pin" size={14} color={theme.colors.textMuted} />
            ) : null}
            <Text
              style={[styles.headerMetaSummaryText, { color: theme.colors.textMuted }]}
              numberOfLines={2}
            >
              {filterState.proximity?.radiusKm ? `Within ${filterState.proximity.radiusKm} km` : "Showing all matches"}
            </Text>
          </View>
        </View>
      }
    >
      <View style={{ marginTop: 10 }}>
        <Input
          label=""
          placeholder="Try bicycle, books, guitar..."
          value={filterState.search}
          onChangeText={filterState.setSearch}
        />
      </View>
      <ListControlsRow
        activeFilterCount={activeFilterCount}
        freeOnly={freeOnly}
        onOpenFilters={onOpenFilters}
        onOpenSort={onOpenSort}
        onToggleFree={onToggleFree}
      />
    </CollapsibleHeaderCard>
  );
}

interface ProductFeedProps {
  userId: string;
  userName: string;
}

type TradeTypeFilter = "ALL" | "BARTER_ONLY" | "OPEN_FOR_MONEY";

export function ProductFeed({ userId, userName }: ProductFeedProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { permission, lastKnown, requestLocation } = useDeviceLocation();
  const filterState = useProductFeedFilters({ limit: 20, excludeOwnerId: userId });
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const dialog = useAppDialog();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOrder>("newest");
  const [isDiscoveryReady, setIsDiscoveryReady] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);
  const [draftRadiusKm, setDraftRadiusKm] = useState<number | null>(null);
  const [selectedTradeType, setSelectedTradeType] = useState<TradeTypeFilter>("ALL");
  const [draftTradeType, setDraftTradeType] = useState<TradeTypeFilter>("ALL");
  const [viewerLocation, setViewerLocation] = useState<{ latitude: number; longitude: number } | null>(
    lastKnown
      ? {
          latitude: lastKnown.latitude,
          longitude: lastKnown.longitude,
        }
      : null,
  );
  const lastRecalcLocationRef = useRef<{ latitude: number; longitude: number } | null>(
    lastKnown
      ? {
          latitude: lastKnown.latitude,
          longitude: lastKnown.longitude,
        }
      : null,
  );

  const categoriesQuery = useCategoriesQuery();
  const requestsById = useAppDataStore((state) => state.requestsById);
  const cachedSentRequests = useMemo(
    () => Object.values(requestsById).filter((req) => req.buyerId === userId),
    [requestsById, userId],
  );
  const products = useProductsListController(filterState.filters, { enabled: isDiscoveryReady });
  const sentRequestsQuery = useRequestsQuery(
    "sent",
    { limit: REQUESTS_SENT_MATCH_LIMIT },
    { enabled: cachedSentRequests.length === 0 },
  );
  const notificationsQuery = useNotificationsQuery({ limit: 20 });
  const markNotificationReadMutation = useMarkNotificationReadMutation();
  const markAllNotificationsReadMutation = useMarkAllNotificationsReadMutation();
  const clearAllNotificationsMutation = useClearAllNotificationsMutation();

  const categories = categoriesQuery.data ?? [];
  const notifications = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [notificationsQuery.data],
  );
  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;
  const requestedProductIds = useMemo(() => {
    const items = sentRequestsQuery.data?.pages.flatMap((page) => page.items) ?? cachedSentRequests;
    return new Set(
      items
        .filter((item) => REQUESTED_STATUSES.includes(item.status))
        .map((item) => item.productId),
    );
  }, [sentRequestsQuery.data]);

  const showInitialLoading =
    products.items.length === 0 &&
    (!isDiscoveryReady || products.query.isPending);
  const showInitialError = Boolean(products.query.error) && products.items.length === 0;

  const visibleProducts = useMemo(() => {
    const next = products.items.filter((item) => {
      const categoryId = item.categoryId;

      if (
        selectedCategoryIds.length > 0 &&
        (typeof categoryId !== "string" || !selectedCategoryIds.includes(categoryId))
      ) {
        return false;
      }

      if (freeOnly && !item.isFree) {
        return false;
      }

      if (selectedTradeType === "OPEN_FOR_MONEY" && !item.requestByMoney) {
        return false;
      }

      if (selectedTradeType === "BARTER_ONLY" && (item.requestByMoney || item.isFree)) {
        return false;
      }

      return true;
    });

    if (sortBy === "nearest" && viewerLocation) {
      next.sort((a, b) => {
        const aDistance =
          a.latitude != null && a.longitude != null
            ? getDistanceKm(viewerLocation, { latitude: a.latitude, longitude: a.longitude })
            : Number.POSITIVE_INFINITY;
        const bDistance =
          b.latitude != null && b.longitude != null
            ? getDistanceKm(viewerLocation, { latitude: b.latitude, longitude: b.longitude })
            : Number.POSITIVE_INFINITY;

        if (aDistance !== bDistance) {
          return aDistance - bDistance;
        }

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return next;
    }

    next.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
    return next;
  }, [freeOnly, products.items, selectedCategoryIds, selectedTradeType, sortBy, viewerLocation]);

  useEffect(() => {
    if (!lastKnown) {
      return;
    }

    const next = {
      latitude: lastKnown.latitude,
      longitude: lastKnown.longitude,
    };
    setViewerLocation(next);
    lastRecalcLocationRef.current = next;
  }, [lastKnown]);

  useEffect(() => {
    if (permission !== "denied") {
      return;
    }

    if (filterState.proximity != null) {
      filterState.setProximity(null);
    }
    setDraftRadiusKm(null);
    setSortBy((current) => (current === "nearest" ? "newest" : current));
    setIsDiscoveryReady(true);
  }, [filterState.proximity, filterState.setProximity, permission]);

  useEffect(() => {
    if (isDiscoveryReady) {
      return;
    }

    if (lastKnown) {
      const next = { latitude: lastKnown.latitude, longitude: lastKnown.longitude };
      setViewerLocation(next);
      lastRecalcLocationRef.current = next;
    }

    setSortBy("newest");
    setIsDiscoveryReady(true);
  }, [isDiscoveryReady, lastKnown]);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const startLocationWatch = async () => {
      if (permission !== "granted") {
        return;
      }

      const snapshot = lastKnown ?? (await requestLocation());
      if (!active || !snapshot) {
        return;
      }

      const initial = { latitude: snapshot.latitude, longitude: snapshot.longitude };
      setViewerLocation(initial);
      lastRecalcLocationRef.current = initial;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 500,
          timeInterval: 60_000,
        },
        (position) => {
          if (!active) {
            return;
          }

          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const baseline = lastRecalcLocationRef.current;
          if (!baseline) {
            lastRecalcLocationRef.current = next;
            setViewerLocation(next);
            return;
          }

          const movedKm = getDistanceKm(baseline, next);
          if (movedKm < LOCATION_RECALCULATE_THRESHOLD_KM) {
            return;
          }

          lastRecalcLocationRef.current = next;
          setViewerLocation(next);

          if (filterState.proximity?.radiusKm != null) {
            filterState.setProximity({
              latitude: next.latitude,
              longitude: next.longitude,
              radiusKm: filterState.proximity.radiusKm,
            });
          }
        },
      );
    };

    void startLocationWatch();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [filterState.proximity, filterState.setProximity, lastKnown, permission, requestLocation]);

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

  useEffect(() => {
    const firstPageItems = products.query.data?.pages[0]?.items ?? [];
    if (firstPageItems.length === 0) {
      return;
    }

    void writeStartupFeedSnapshot(userId, firstPageItems);
  }, [products.query.data, userId]);

  const onRefreshNotifications = async () => {
    await notificationsQuery.refetch();
  };

  const onManualRefreshFeed = () => {
    setIsManualRefreshing(true);

    void products.query
      .refetch()
      .finally(() => {
        setIsManualRefreshing(false);
      });
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

  const onToggleFree = useCallback(() => setFreeOnly((c) => !c), []);

  const onOpenNotificationsPanel = useCallback(() => {
    setShowNotifications(true);
  }, []);

  const onOpenFilters = useCallback(() => {
    setDraftCategoryIds(selectedCategoryIds);
    setDraftRadiusKm(permission === "granted" ? (filterState.proximity?.radiusKm ?? null) : null);
    setDraftTradeType(selectedTradeType);
    setShowFilterModal(true);
  }, [selectedCategoryIds, permission, filterState.proximity?.radiusKm, selectedTradeType]);

  const onRequestEnableNearby = async () => {
    if (permission === "granted") {
      setDraftRadiusKm((current) => current ?? DEFAULT_NEAREST_RADIUS_KM);
      return;
    }

    const snapshot = await requestLocation();
    if (!snapshot) {
      setDraftRadiusKm(null);
      await dialog.alert(
        "Location required",
        "Nearby needs location permission. Enable it to filter by distance.",
      );
      return;
    }

    const next = { latitude: snapshot.latitude, longitude: snapshot.longitude };
    setViewerLocation(next);
    lastRecalcLocationRef.current = next;
    setDraftRadiusKm((current) => current ?? DEFAULT_NEAREST_RADIUS_KM);
  };

  const onApplyFilters = async () => {
    if (draftRadiusKm == null) {
      filterState.setProximity(null);
    } else {
      const snapshot = lastKnown ?? (await requestLocation());
      if (!snapshot) {
        await dialog.alert("Location required", "Enable location to use proximity filter.");
        return;
      }

      filterState.setProximity({
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        radiusKm: draftRadiusKm,
      });
      const next = { latitude: snapshot.latitude, longitude: snapshot.longitude };
      setViewerLocation(next);
      lastRecalcLocationRef.current = next;
      setSortBy("nearest");
    }

    setSelectedCategoryIds(draftCategoryIds);
    filterState.setCategoryId("");
    setSelectedTradeType(draftTradeType);
    setShowFilterModal(false);
  };

  const onOpenSortPicker = useCallback(() => {
    setShowSortModal(true);
  }, []);

  const onSelectSort = async (nextSort: SortOrder) => {
    if (nextSort === "nearest" && !viewerLocation) {
      const snapshot = await requestLocation();
      if (!snapshot) {
        await dialog.alert("Location required", "Enable location to sort listings by nearest.");
        return;
      }

      const next = { latitude: snapshot.latitude, longitude: snapshot.longitude };
      setViewerLocation(next);
      lastRecalcLocationRef.current = next;
    }

    setSortBy(nextSort);
    setShowSortModal(false);
  };

  const activeFilterCount =
    (selectedCategoryIds.length > 0 ? 1 : 0) +
    (filterState.proximity?.radiusKm ? 1 : 0) +
    (selectedTradeType !== "ALL" ? 1 : 0);
  const showFeedEndMessage =
    visibleProducts.length > 0 &&
    !showInitialLoading &&
    !showInitialError &&
    !products.query.isFetchingNextPage &&
    !products.query.hasNextPage;
  const isBackgroundRefreshing =
    products.query.isFetching &&
    !showInitialLoading &&
    !isManualRefreshing &&
    !products.query.isFetchingNextPage;

  const onOpenProduct = useCallback(
    (item: ProductSummary) => {
      const distanceKm =
        viewerLocation && item.latitude != null && item.longitude != null
          ? getDistanceKm(viewerLocation, { latitude: item.latitude, longitude: item.longitude })
          : null;

      router.push({
        pathname: "/(app)/products/[id]",
        params: {
          id: item.id,
          ...(distanceKm != null ? { distanceKm: distanceKm.toString() } : null),
        },
      });
    },
    [router, viewerLocation],
  );

  const renderProductItem = useCallback(
    ({ item }: { item: ProductSummary }) => (
      <ProductCard
        product={item}
        onPressProduct={onOpenProduct}
        showMeta
        isRequested={requestedProductIds.has(item.id)}
        viewerLocation={permission === "granted" ? viewerLocation : null}
        canShowRelativeDistance={permission === "granted"}
      />
    ),
    [onOpenProduct, permission, requestedProductIds, viewerLocation],
  );

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.listHeaderWrap}>
          <FeedHeaderCard
            userName={userName}
            filterState={filterState}
            activeFilterCount={activeFilterCount}
            freeOnly={freeOnly}
            onToggleFree={onToggleFree}
            onOpenFilters={onOpenFilters}
            onOpenSort={onOpenSortPicker}
            productCount={visibleProducts.length}
            onOpenNotificationsPanel={onOpenNotificationsPanel}
            unreadCount={unreadCount}
            isBackgroundRefreshing={isBackgroundRefreshing}
          />
        </View>

        <FlatList
          data={visibleProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          refreshControl={
            <RefreshControl refreshing={isManualRefreshing} onRefresh={onManualRefreshFeed} />
          }
          onEndReachedThreshold={0.35}
          onEndReached={products.loadMore}
          ListEmptyComponent={
            showInitialLoading ? (
              initialLoadTimedOut ? (
                <ErrorView
                  title='Taking longer than expected'
                  message='Loading is taking longer than expected. Check your connection and retry.'
                  buttons={[
                    {
                      label: 'Retry',
                      onPress: products.refresh,
                    },
                  ]}
                />
              ) : (
                <ProductListLoadingState spinnerSize={30} />
              )
            ) : showInitialError ? (
              <ErrorView
                title='Could not load listings'
                message='Something went wrong. Please try again.'
                buttons={[
                  {
                    label: 'Retry',
                    onPress: products.refresh,
                  },
                ]}
              />
            ) : (
              <EmptyView
                title="No listings found"
                message="Try adjusting your filters to see more results."
              />
            )
          }
          ListFooterComponent={
            products.query.isFetchingNextPage ? (
              <ProductListFooterLoadingState />
            ) : showFeedEndMessage ? (
              <View style={styles.endListWrap}>
                <Text style={[styles.endListText, { color: theme.colors.textMuted }]}>You made it to the end. No more listings hiding below.</Text>
              </View>
            ) : null
          }
          renderItem={renderProductItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </View>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          style={[styles.notificationsBackdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setShowFilterModal(false)}
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
              // Keep modal open when tapping inside.
            }}
          >
            <View style={styles.notificationsHeaderRow}>
              <Text style={[styles.notificationsTitle, { color: theme.colors.textPrimary }]}>Filters</Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <Feather name="x" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Category</Text>
              <CategoryMultiSelectChips
                categories={categories}
                selectedIds={draftCategoryIds}
                onChangeSelectedIds={setDraftCategoryIds}
                containerStyle={styles.filterOptionsWrap}
              />
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Proximity</Text>
              <View style={styles.filterOptionsWrap}>
                <FilterChip
                  active={draftRadiusKm == null}
                  label="Anywhere"
                  onPress={() => setDraftRadiusKm(null)}
                />
                <FilterChip
                  active={draftRadiusKm != null}
                  label="Nearby"
                  onPress={() => {
                    void onRequestEnableNearby();
                  }}
                />
              </View>

              {permission !== "granted" ? (
                <Text style={[styles.sliderHintText, { color: theme.colors.textMuted }]}> 
                  Nearby is disabled until location permission is granted.
                </Text>
              ) : null}

              {draftRadiusKm != null && permission === "granted" ? (
                <View
                  style={[
                    styles.radiusSliderWrap,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.radiusValueText, { color: theme.colors.textPrimary }]}> 
                    Range: {Math.round(draftRadiusKm)} km
                  </Text>
                  <RangeSlider
                    style={styles.radiusSlider}
                    minimumValue={MIN_PROXIMITY_KM}
                    maximumValue={MAX_PROXIMITY_KM}
                    step={1}
                    value={Math.round(draftRadiusKm)}
                    disabled={false}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.border}
                    thumbTintColor={theme.colors.primary}
                    onValueChange={(value: number) => {
                      setDraftRadiusKm(Math.round(value));
                    }}
                  />
                  <View style={styles.radiusLabelsRow}>
                    <Text style={[styles.radiusLabelText, { color: theme.colors.textMuted }]}>{MIN_PROXIMITY_KM} km</Text>
                    <Text style={[styles.radiusLabelText, { color: theme.colors.textMuted }]}>{MAX_PROXIMITY_KM} km</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Type</Text>
              <View style={styles.filterOptionsWrap}>
                <FilterChip
                  active={draftTradeType === "ALL"}
                  label="All"
                  onPress={() => setDraftTradeType("ALL")}
                />
                <FilterChip
                  active={draftTradeType === "BARTER_ONLY"}
                  label="Trade only"
                  onPress={() => setDraftTradeType("BARTER_ONLY")}
                />
                <FilterChip
                  active={draftTradeType === "OPEN_FOR_MONEY"}
                  label="Cash or Trade"
                  onPress={() => setDraftTradeType("OPEN_FOR_MONEY")}
                />
              </View>
            </View>

            <View style={styles.filterActionsRow}>
              <Pressable
                style={[
                  styles.filterActionButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                ]}
                onPress={() => {
                  setDraftCategoryIds([]);
                  setDraftRadiusKm(null);
                  setDraftTradeType("ALL");
                }}
              >
                <Text style={[styles.filterActionText, { color: theme.colors.textSecondary }]}>Clear</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterActionButton,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                onPress={() => {
                  void onApplyFilters();
                }}
              >
                <Text style={[styles.filterActionText, { color: theme.colors.onPrimary }]}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <SortBottomSheet
        visible={showSortModal}
        value={sortBy}
        onClose={() => setShowSortModal(false)}
        onChange={onSelectSort}
        canUseNearest={permission === "granted" && viewerLocation != null}
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


                {notifications.length > 0 ? (
                  <>
                    <Pressable
                      onPress={() => {
                        void clearAllNotificationsMutation.mutateAsync();
                        setShowNotifications(false);
                      }}
                      disabled={clearAllNotificationsMutation.isPending}
                      style={styles.notificationsActionButton}
                    >
                      <Text style={[styles.notificationsActionText, { color: theme.colors.textSecondary }]}>Clear all</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setShowNotificationsMenu((prev) => !prev)}
                      style={styles.notificationsIconAction}
                    >
                      <Feather
                        name={showNotificationsMenu ? "chevron-up" : "chevron-down"}
                        size={15}
                        color={theme.colors.textSecondary}
                      />
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            {showNotificationsMenu ? (
              <View style={[styles.notificationsMenu, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <Pressable
                  onPress={() => {
                    void markAllNotificationsReadMutation.mutateAsync();
                    setShowNotificationsMenu(false);
                  }}
                  disabled={unreadCount === 0 || markAllNotificationsReadMutation.isPending}
                  style={styles.notificationsMenuItem}
                >
                  {markAllNotificationsReadMutation.isPending ? (
                    <ActivityIndicator size={14} color={theme.colors.textPrimary} />
                  ) : (
                    <Feather name="check" size={14} color={theme.colors.textPrimary} />
                  )}
                  <Text style={[styles.notificationsMenuItemText, { color: theme.colors.textPrimary }]}>Mark all read</Text>
                </Pressable>
              </View>
            ) : null}

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 108, paddingTop: 2, gap: 2 },
  listHeaderWrap: { marginBottom: 10, paddingHorizontal: 16, paddingTop: 16 },
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
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerMetaSummaryContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  headerMetaCounterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 22,
  },
  headerMetaCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  headerMetaCountLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerMetaSummaryText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  listSummaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listSummarySecondaryText: {
    minWidth: 96,
    textAlign: "right",
  },
  listSummarySecondaryHidden: {
    opacity: 0,
  },
  endListWrap: {
    alignItems: "center",
    paddingTop: 27,
    paddingBottom: 2,
  },
  endListText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
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
  notificationsActionButton: {
    paddingHorizontal: 4,
  },
  notificationsMenu: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  notificationsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  notificationsMenuItemText: {
    fontSize: 13,
    fontWeight: "600",
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
  filterSection: {
    gap: 8,
  },
  filterOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sliderHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
  radiusSliderWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
  radiusValueText: {
    fontSize: 13,
    fontWeight: "700",
  },
  radiusSlider: {
    width: "100%",
    height: 34,
  },
  radiusLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  radiusLabelText: {
    fontSize: 11,
    fontWeight: "600",
  },
  filterActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  filterActionButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActionText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
