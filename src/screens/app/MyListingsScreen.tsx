import { ActivityIndicator, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState, memo, useCallback } from "react";
import { useRouter } from "expo-router";
import type { ProductSummary, RequestStatus, RequestSummary } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { REQUESTS_SHARED_LIMIT, useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import {
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { SearchInput } from "@/components/ui/SearchInput";
import { CollapsibleHeaderCard } from "@/components/ui/CollapsibleHeaderCard";
import { FilterChip } from "@/components/filters/FilterChip";
import { CategoryMultiSelectChips } from "@/components/filters/CategoryMultiSelectChips";
import { ListControlsRow } from "@/components/filters/ListControlsRow";
import { SortBottomSheet, type SortOrder } from "@/components/filters/SortBottomSheet";
import { AnchoredContextMenu, ContextMenuAnchor } from "@/components/ui/AnchoredContextMenu";
import { ProductExchangeBadge } from "@/components/products/ProductExchangeBadge";
import { ProductMetadata, hasExchangeHistory } from "@/components/products/ProductMetadata";
import { AppImage } from "@/components/ui/AppImage";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useListingImagePreparationStore } from "@/lib/forms/listingImagePreparationStore";
import { ErrorView } from "@/components/ui/ErrorView";
import { EmptyView } from "@/components/ui/EmptyView";
// ↓ shared hook
import { useListingContextMenuItems } from "@/hooks/useListingContextMenuItems";
import { ScreenSafeView } from "@/components/layout/ScreenSafeView";
import { isProductReportedAboveThreshold } from "@/lib/listings/productReportThreshold";
import { getStatusPillStyle } from "@/components/products/ProductTags";

import { injectAds, isAdPlaceholder } from "@/lib/ads/injectAds";
import { NativeAdCard } from "@/components/ads/NativeAdCard";
import { ADS_ENABLED } from "@/lib/ads/adConfig";
import { CustomFlatList } from "@/components/ui/CustomFlatList";

type ListingFilter = "ALL" | ProductSummary["status"];
type TradeTypeFilter = "ALL" | "BARTER_ONLY" | "OPEN_FOR_MONEY" | "MONEY_ONLY";

const LISTING_FILTERS: Array<{ key: ListingFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "RESERVED", label: "Reserved" },
  { key: "EXCHANGED", label: "Exchanged" },
];

const OPEN_REQUEST_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING"];
const OPEN_REQUEST_DISPLAY_CAP = 10;

/**
 * OPTIMIZATION: ListingItem is memoized to prevent unnecessary re-renders
 * when parent (MyListingsScreen) updates but this item's props are unchanged.
 */
const ListingItem = memo(
  function ListingItem({
    item,
    router,
    theme,
    styles,
    openRequestCount,
    reservedRequest,
    isPreparing,
    isActivating,
    hasUploadFailure,
    hasMissingImageLock,
    localPreviewUri,
    onContextMenuOpen,
  }: {
    item: ProductSummary;
    router: ReturnType<typeof useRouter>;
    theme: any;
    styles: any;
    openRequestCount: number;
    reservedRequest?: RequestSummary | null;
    isPreparing: boolean;
    isActivating: boolean;
    hasUploadFailure: boolean;
    hasMissingImageLock: boolean;
    localPreviewUri: string | null;
    onContextMenuOpen: (productId: string, anchor: { left: number; top: number; bottom: number }) => void;
  }) {
    const displayOpenRequestCount = openRequestCount > OPEN_REQUEST_DISPLAY_CAP ? "10+" : `${openRequestCount}`;
    const isReported = isProductReportedAboveThreshold(item);

    return (
      <View style={[styles.itemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <Pressable
          onPress={
            isPreparing || hasUploadFailure || hasMissingImageLock
              ? undefined
              : () =>
                  router.push({
                    pathname: "/(app)/products/[id]",
                    params: { id: item.id, backTo: "my-listings" },
                  })
          }
          disabled={isPreparing || hasUploadFailure || hasMissingImageLock}
          style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.95 : 1 }]}
        >
          <ListingPreview
            product={item}
            isPreparing={isPreparing}
            isActivating={isActivating}
            hasUploadFailure={hasUploadFailure}
            hasMissingImageLock={hasMissingImageLock}
            localPreviewUri={localPreviewUri}
            isReported={isReported}
          />
          {!isReported && (item.status === "ACTIVE" || item.status === "EXCHANGED" || item.status === "INACTIVE") ? (
            <Pressable
              style={[
                styles.editIconButton,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
              onPress={(event) => {
                const { pageX, pageY, locationX, locationY } = event.nativeEvent;
                const buttonLeft = pageX - locationX;
                const buttonTop = pageY - locationY;
                const buttonSize = 38;
                onContextMenuOpen(item.id, {
                  left: buttonLeft,
                  top: buttonTop,
                  bottom: buttonTop + buttonSize,
                });
              }}
              hitSlop={8}
            >
              <Feather name="more-vertical" size={16} color={theme.colors.textPrimary} />
            </Pressable>
          ) : null}
        </Pressable>

        {item.status === "RESERVED" && reservedRequest ? (
          <View
            style={[
              styles.openRequestCard,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.openRequestInfoWrap}>
              {/* <Text style={[styles.openRequestCardTitle, { color: theme.colors.textPrimary }]}>Reserved</Text> */}
              <Text style={[styles.openRequestCardSubtitle, { color: theme.colors.textMuted, fontWeight: "500" }]}>
                {reservedRequest.buyer?.userName
                  ? `${reservedRequest.buyer.userName} reserved this listing`
                  : "Reserved by a buyer"}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/(app)/requests/${reservedRequest.id}`)}
              style={[styles.openRequestViewButton, { borderColor: "#111827", backgroundColor: "#111827" }]}
            >
              <Text style={[styles.openRequestViewButtonText, { color: "#ffffff" }]}>View</Text>
            </Pressable>
          </View>
        ) : openRequestCount > 0 ? (
          <View
            style={[
              styles.openRequestCard,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.openRequestInfoWrap}>
              <Text style={[styles.openRequestCardTitle, { color: theme.colors.textPrimary }]}>Open requests</Text>
              <Text style={[styles.openRequestCardSubtitle, { color: theme.colors.textMuted }]}>
                {displayOpenRequestCount} active request{openRequestCount > 1 ? "s" : ""} for this listing.
              </Text>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(app)/(tabs)/requests",
                  params: { tab: "received", productId: item.id, _t: Date.now().toString() },
                })
              }
              style={[styles.openRequestViewButton, { borderColor: "#111827", backgroundColor: "#111827" }]}
            >
              <Text style={[styles.openRequestViewButtonText, { color: "#ffffff" }]}>View</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  },
);

// ── MyListingsScreen ──────────────────────────────────────────────────────────

export default function MyListingsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const session = useSession();
  const categoriesQuery = useCategoriesQuery();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSortModal, setShowSortModal] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOrder>("newest");
  const [selectedFilter, setSelectedFilter] = useState<ListingFilter>("ALL");
  const [draftFilter, setDraftFilter] = useState<ListingFilter>("ALL");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);
  const [selectedTradeType, setSelectedTradeType] = useState<TradeTypeFilter>("ALL");
  const [draftTradeType, setDraftTradeType] = useState<TradeTypeFilter>("ALL");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Context-menu anchor state (which card's "…" was tapped)
  const [contextMenuProductId, setContextMenuProductId] = useState<string | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ left: number; top: number; bottom: number } | null>(null);

  const products = useProductsListController({ ownerId: session?.user.id, limit: 40 });
  const sentRequestsQuery = useRequestsQuery("sent", { limit: REQUESTS_SHARED_LIMIT });
  const receivedRequestsQuery = useRequestsQuery("received", { limit: REQUESTS_SHARED_LIMIT });
  const categories = categoriesQuery.data ?? [];
  const pendingByProductId = useListingImagePreparationStore((state) => state.pendingByProductId);
  const clearPreparing = useListingImagePreparationStore((state) => state.clearPreparing);

  const [sortAnchor, setSortAnchor] = useState<ContextMenuAnchor | null>(null);

  const closeContextMenu = () => {
    setContextMenuProductId(null);
    setContextMenuAnchor(null);
  };

  const closeSortModal = () => {
    setShowSortModal(false);
    setSortAnchor(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const visibleItems = useMemo(
    () => products.items.filter((item) => item.status !== "REMOVED"),
    [products.items],
  );

  const onOpenSortAnchor = useCallback((anchor: ContextMenuAnchor) => {
    setSortAnchor(anchor);
  }, []);

  useEffect(() => {
    for (const item of visibleItems) {
      const prepState = pendingByProductId[item.id];
      if (!prepState) continue;
      const hasServerImage = (item.productImages?.length ?? 0) > 0;
      const isFullyActive = item.status === "ACTIVE" && hasServerImage;
      if (isFullyActive && prepState.phase !== "failed") {
        clearPreparing(item.id);
      }
    }
  }, [clearPreparing, pendingByProductId, visibleItems]);

  const filteredWithoutType = useMemo(() => {
    const normalizedQuery = debouncedSearch.trim().toLowerCase();
    return visibleItems.filter((item) => {
      if (freeOnly && !item.isFree) return false;
      if (selectedTradeType === "MONEY_ONLY" && !(item.requestByMoney && !item.allowTradeRequest && !item.isFree)) return false;
      if (selectedTradeType === "OPEN_FOR_MONEY" && !(item.allowTradeRequest && item.requestByMoney && !item.isFree)) return false;
      if (selectedTradeType === "BARTER_ONLY" && !(item.allowTradeRequest && !item.requestByMoney && !item.isFree)) return false;
      if (selectedCategoryIds.length > 0 && (typeof item.categoryId !== "string" || !selectedCategoryIds.includes(item.categoryId))) return false;
      if (!normalizedQuery) return true;
      const haystack = `${item.title} ${item.description ?? ""} ${item.category?.name ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [debouncedSearch, freeOnly, selectedCategoryIds, selectedTradeType, visibleItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<ProductSummary["status"], number> = {
      ACTIVE: 0, INACTIVE: 0, RESERVED: 0, EXCHANGED: 0, REMOVED: 0, REPORTED: 0
    };
    for (const item of filteredWithoutType) counts[item.status] += 1;
    return counts;
  }, [filteredWithoutType]);

  const filteredItems = useMemo(() => {
    const byType = selectedFilter === "ALL" ? filteredWithoutType : filteredWithoutType.filter((item) => item.status === selectedFilter);
    return [...byType].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [filteredWithoutType, selectedFilter, sortBy]);

  const feedItems = useMemo<any[]>(
    () => ADS_ENABLED && filteredItems.length > 0 ? injectAds(filteredItems, 2) : filteredItems,
    [filteredItems],
  );

  const openRequestCountByProductId = useMemo(() => {
    const requests = receivedRequestsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const map = new Map<string, number>();
    for (const request of requests) {
      if (!OPEN_REQUEST_STATUSES.includes(request.status)) continue;
      map.set(request.productId, (map.get(request.productId) ?? 0) + 1);
    }
    return map;
  }, [receivedRequestsQuery.data]);

  const reservedRequestByProductId = useMemo(() => {
    const requests = receivedRequestsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const map = new Map<string, RequestSummary>();
    for (const request of requests) {
      if (request.status === "ACCEPTED") map.set(request.productId, request);
    }
    return map;
  }, [receivedRequestsQuery.data]);

  // The product currently targeted by the open context menu
  const contextMenuProduct = useMemo(
    () => filteredItems.find((item) => item.id === contextMenuProductId) ?? null,
    [contextMenuProductId, filteredItems],
  );

  // ── Shared context-menu hook ────────────────────────────────────────────────
  const { items: contextMenuItems } = useListingContextMenuItems({
    product: contextMenuProduct,
    returnTo: "my-listings",
  });

  const selectedFilterLabel = LISTING_FILTERS.find((item) => item.key === selectedFilter)?.label ?? "All";
  const selectedCategoryLabel =
    selectedCategoryIds.length === 1
      ? (categories.find((category) => category.id === selectedCategoryIds[0])?.name ?? "1 category")
      : `${selectedCategoryIds.length} categories`;
  const selectedTradeTypeLabel =
    selectedTradeType === "BARTER_ONLY" ? "Trade only"
    : selectedTradeType === "MONEY_ONLY" ? "Cash only"
    : selectedTradeType === "OPEN_FOR_MONEY" ? "Cash or Trade"
    : "All";
  const activeFilterCount =
    (selectedCategoryIds.length > 0 ? 1 : 0) +
    (selectedFilter !== "ALL" ? 1 : 0) +
    (selectedTradeType !== "ALL" ? 1 : 0);
  const showListingsEndMessage =
    filteredItems.length > 0 &&
    !products.query.isPending &&
    !products.query.error &&
    !products.query.isFetchingNextPage &&
    !products.query.hasNextPage;
  const selectedFilterSummary = [
    selectedCategoryIds.length > 0 ? selectedCategoryLabel : null,
    selectedFilter !== "ALL" ? selectedFilterLabel : null,
    selectedTradeType !== "ALL" ? selectedTradeTypeLabel : null,
  ].filter(Boolean).join(" • ");

  const onOpenFilterPicker = () => {
    setDraftFilter(selectedFilter);
    setDraftCategoryIds(selectedCategoryIds);
    setDraftTradeType(selectedTradeType);
    setShowFilterModal(true);
  };

  const onApplyFilter = () => {
    setSelectedFilter(draftFilter);
    setSelectedCategoryIds(draftCategoryIds);
    setSelectedTradeType(draftTradeType);
    if (draftTradeType !== "ALL") setFreeOnly(false);
    setShowFilterModal(false);
  };

  const onManualRefresh = () => {
    setIsManualRefreshing(true);
    void Promise.allSettled([
      products.query.refetch(),
      sentRequestsQuery.refetch(),
      receivedRequestsQuery.refetch(),
    ]).finally(() => setIsManualRefreshing(false));
  };

  if (!session || products.query.isPending) {
    return (
      <ScreenSafeView>
        <ProductListLoadingState spinnerSize={30} />
      </ScreenSafeView>
    );
  }

  return (
    <ScreenSafeView>
      {products.query.error ? (
        <ErrorView
          title="Could not load your listing"
          message="Something went wrong. Please try again."
          buttons={[{ label: "Retry", onPress: () => void products.refresh() }]}
        />
      ) : (
        <>
          <View style={styles.fixedTopContent}>
            <CollapsibleHeaderCard
              title="My Listings"
              subtitle="Manage your listings"
              collapseMaxHeight={320}
              footerSlot={
                <View style={styles.headerMetaRow}>
                  <View style={styles.headerMetaCountPill}>
                    <Text style={[styles.headerMetaCountText, { color: theme.colors.textPrimary }]}>
                      {filteredItems.length}
                    </Text>
                    <Text style={[styles.headerMetaCountLabel, { color: theme.colors.textMuted }]}>
                      {filteredItems.length === 1 || filteredItems.length === 0 ? "listing" : "listings"}
                    </Text>
                  </View>
                  <Text style={[styles.headerMetaSummaryText, { color: theme.colors.textMuted }]} numberOfLines={2}>
                    {selectedFilterSummary || "Showing all listings"}
                  </Text>
                </View>
              }
            >
              <View style={{ marginTop: 10 }}>
                <SearchInput
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <ListControlsRow
                activeFilterCount={activeFilterCount}
                freeOnly={freeOnly}
                sortActive={sortBy !== "newest"}
                onOpenFilters={onOpenFilterPicker}
                onOpenSort={() => setShowSortModal(true)}
                onToggleFree={() => {
                  setFreeOnly((current) => {
                    if (!current) setSelectedTradeType("ALL");
                    return !current;
                  });
                }}
                onSortAnchor={onOpenSortAnchor}
              />
            </CollapsibleHeaderCard>
          </View>

          <CustomFlatList
            data={feedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isManualRefreshing} onRefresh={onManualRefresh} />}
            onEndReachedThreshold={0.35}
            onEndReached={products.loadMore}
            ListEmptyComponent={
              <EmptyView
                title={
                  selectedFilter === "ALL"
                    ? "You haven't listed yet."
                    : `No ${selectedFilterLabel.toLowerCase()} listings found.`
                }
                message={
                  selectedFilter === "ALL"
                    ? "Create listing and it will show up here."
                    : "Try adjusting your filters to see more results."
                }
                buttons={
                  selectedFilter === "ALL"
                    ? [{ label: "Create listing", onPress: () => router.push("/(app)/(tabs)/create") }]
                    : undefined
                }
              />
            }
            ListFooterComponent={
              products.query.isFetchingNextPage ? (
                <ProductListFooterLoadingState />
              ) : showListingsEndMessage ? (
                <View style={styles.endListWrap}>
                  <Text style={[styles.endListText, { color: theme.colors.textMuted }]}>
                    All caught up. Your listings have no secret bottom level.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              if (isAdPlaceholder(item)) return <NativeAdCard />;

              // after this point TS knows item is ProductSummary
              const product = item;
              const imagePreparation = pendingByProductId[product.id];
              const hasNoServerImage = (product.productImages?.length ?? 0) === 0;
              const isPreparing = imagePreparation?.phase === "uploading" && hasNoServerImage;
              const isActivating = imagePreparation?.phase === "activating";
              const hasUploadFailure = imagePreparation?.phase === "failed" && hasNoServerImage;
              const hasMissingImageLock =
                product.status === "INACTIVE" && hasNoServerImage && !isPreparing && !hasUploadFailure;

              return (
                <ListingItem
                  item={product}
                  router={router}
                  theme={theme}
                  styles={styles}
                  openRequestCount={openRequestCountByProductId.get(product.id) ?? 0}
                  reservedRequest={reservedRequestByProductId.get(product.id) ?? null}
                  isPreparing={isPreparing}
                  isActivating={isActivating}
                  hasUploadFailure={hasUploadFailure}
                  hasMissingImageLock={hasMissingImageLock}
                  localPreviewUri={imagePreparation?.localPreviewUri ?? null}
                  onContextMenuOpen={(productId, anchor) => {
                    setContextMenuProductId(productId);
                    setContextMenuAnchor(anchor);
                  }}
                />
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </>
      )}

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View
          style={[styles.sortBackdrop, { backgroundColor: theme.colors.overlay }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
          <View
            style={[styles.sortSheet, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            >
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>Filter listings</Text>
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
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Types</Text>
              <View style={styles.filterOptionsWrap}>
                {LISTING_FILTERS.map((filter) => {
                  const count =
                    filter.key === "ALL"
                      ? filteredWithoutType.length
                      : statusCounts[filter.key as ProductSummary["status"]];
                  if (count === 0 && filter.key !== "ALL") return null;
                  return (
                    <FilterChip
                      key={filter.key}
                      active={draftFilter === filter.key}
                      label={`${filter.label} (${count})`}
                      onPress={() => setDraftFilter(filter.key)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Offer type</Text>
              <View style={styles.filterOptionsWrap}>
                <FilterChip active={draftTradeType === "ALL"} label="All" onPress={() => setDraftTradeType("ALL")} />
                <FilterChip active={draftTradeType === "BARTER_ONLY"} label="Trade only" onPress={() => setDraftTradeType("BARTER_ONLY")} />
                <FilterChip active={draftTradeType === "MONEY_ONLY"} label="Cash only" onPress={() => setDraftTradeType("MONEY_ONLY")} />
                <FilterChip active={draftTradeType === "OPEN_FOR_MONEY"} label="Cash or Trade" onPress={() => setDraftTradeType("OPEN_FOR_MONEY")} />
              </View>
            </View>

            <View style={styles.filterActionsRow}>
              <Pressable
                style={[styles.filterActionButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                onPress={() => { setDraftFilter("ALL"); setDraftCategoryIds([]); setDraftTradeType("ALL"); }}
              >
                <Text style={[styles.filterActionText, { color: theme.colors.textSecondary }]}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.filterActionButton, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]}
                onPress={onApplyFilter}
              >
                <Text style={[styles.filterActionText, { color: theme.colors.onPrimary }]}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SortBottomSheet
        visible={showSortModal}
        value={sortBy}
        onClose={closeSortModal}
        onChange={setSortBy}
        anchor={sortAnchor}
        showNearestOption={false}
      />

      <AnchoredContextMenu
        visible={Boolean(contextMenuProductId && contextMenuAnchor)}
        anchor={contextMenuAnchor}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />
    </ScreenSafeView>
  );
}

// ── ListingPreview (unchanged) ────────────────────────────────────────────────

function ListingPreview({
  product,
  isPreparing = false,
  isActivating = false,
  hasUploadFailure = false,
  hasMissingImageLock = false,
  localPreviewUri = null,
  isReported = false,
}: {
  product: ProductSummary;
  isPreparing?: boolean;
  isActivating?: boolean;
  hasUploadFailure?: boolean;
  hasMissingImageLock?: boolean;
  localPreviewUri?: string | null;
  isReported?: boolean;
}) {
  const { theme } = useAppTheme();
  const primaryImage = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0];
  const displayImageUri = primaryImage?.url ?? localPreviewUri;
  const isLive = isReported ? false : product.status === "ACTIVE";
  const pillStyle = getStatusPillStyle({ status: product.status, isReported, isLive, theme });

  return (
    <View style={styles.previewWrap}>
      <View style={styles.imageWrap}>
        {displayImageUri ? (
          <>
            <AppImage uri={displayImageUri} style={styles.image} />
            {isPreparing ? (
              <View style={[styles.imageStatusOverlay, { backgroundColor: "rgba(15, 23, 42, 0.45)" }]}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={[styles.imageStatusTitle, { color: "#ffffff" }]}>Post is getting prepared</Text>
              </View>
            ) : null}
            {isActivating ? (
              <View style={[styles.imageStatusOverlay, { backgroundColor: "rgba(15, 23, 42, 0.35)" }]}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={[styles.imageStatusTitle, { color: "#ffffff" }]}>Publishing listing...</Text>
              </View>
            ) : null}
            {hasUploadFailure ? (
              <View style={[styles.imageStatusOverlay, { backgroundColor: "rgba(127, 29, 29, 0.68)" }]}>
                <Text style={[styles.imageStatusTitle, { color: "#ffffff" }]}>Image upload failed</Text>
                <Text style={[styles.imageStatusSubtitle, { color: "rgba(255,255,255,0.9)" }]}>Use Edit to re-upload image</Text>
              </View>
            ) : null}
            {hasMissingImageLock ? (
              <View style={[styles.imageStatusOverlay, { backgroundColor: "rgba(15, 23, 42, 0.45)" }]}>
                <Text style={[styles.imageStatusTitle, { color: "#ffffff" }]}>Listing is being prepared</Text>
                <Text style={[styles.imageStatusSubtitle, { color: "rgba(255,255,255,0.9)" }]}>At least one image is required before activation</Text>
              </View>
            ) : null}
            {hasExchangeHistory(product) ? <ProductExchangeBadge position="left" /> : null}
          </>
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Text style={[styles.imageFallbackText, { color: theme.colors.textMuted }]}>No image available</Text>
            {hasExchangeHistory(product) ? <ProductExchangeBadge position="left" /> : null}
          </View>
        )}
      </View>

      <View style={styles.previewContent}>
        <View style={styles.previewHeaderRow}>
          <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {product.title}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: pillStyle.bg,
                borderColor: pillStyle.border,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: pillStyle.text }]}>
              {isReported ? "REPORTED" : product.status}
            </Text>
          </View>
        </View>
        <View style={styles.previewTagsWrap}>
          <ProductMetadata product={product} variant="compact" showCategory={false} showLocation={false} />
        </View>
      </View>
    </View>
  );
}

// ── Styles (identical to original) ───────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fixedTopContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 110 },
  headerMetaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerMetaCountPill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 22 },
  headerMetaCountText: { fontSize: 12, fontWeight: "800" },
  headerMetaCountLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  headerMetaSummaryText: { fontSize: 13, minWidth: 0, flex: 1, lineHeight: 18, flexShrink: 1, textAlign: "right" },
  endListWrap: { alignItems: "center", paddingTop: 27, paddingBottom: 2 },
  endListText: { fontSize: 12, fontWeight: "600" },
  sortBackdrop: { flex: 1, justifyContent: "flex-end" },
  sortSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, gap: 10 },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  filterSection: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "700" },
  filterOptionsWrap: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  filterActionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  filterActionButton: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center" },
  filterActionText: { fontSize: 14, fontWeight: "700" },
  itemCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  cardBody: { position: "relative" },
  previewWrap: { padding: 10, gap: 10 },
  imageWrap: { width: "100%", height: 168, borderRadius: 12, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageStatusOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 10 },
  imageStatusTitle: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  imageStatusSubtitle: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  imageFallbackText: { fontSize: 14, fontWeight: "600" },
  previewContent: { gap: 6, paddingHorizontal: 4, paddingBottom: 2 },
  previewHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  previewTitle: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: "800" },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  previewTagsWrap: { marginTop: 4 },
  openRequestCard: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  openRequestInfoWrap: { flex: 1, minWidth: 0, gap: 2 },
  openRequestCardTitle: { fontSize: 13, fontWeight: "800" },
  openRequestCardSubtitle: { fontSize: 12 },
  openRequestViewButton: { borderWidth: 1, borderRadius: 999, minHeight: 32, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" },
  openRequestViewButtonText: { fontSize: 12, fontWeight: "700" },
  editIconButton: { position: "absolute", top: 18, right: 18, width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});