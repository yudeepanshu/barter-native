import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useState, memo, useCallback } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ProductSummary, RequestStatus } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { REQUESTS_SHARED_LIMIT, useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import {
  toErrorMessage,
  useDeleteProductMutation,
} from "@/hooks/mutations/useDeleteProductMutation";
import {
  toErrorMessage as toRelistErrorMessage,
  useRelistProductMutation,
} from "@/hooks/mutations/useRelistProductMutation";
import {
  toErrorMessage as toUnlistErrorMessage,
  useUnlistProductMutation,
} from "@/hooks/mutations/useUnlistProductMutation";
import {
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { Input } from "@/components/ui/Input";
import { CollapsibleHeaderCard } from "@/components/ui/CollapsibleHeaderCard";
import { FilterChip } from "@/components/filters/FilterChip";
import { CategoryMultiSelectChips } from "@/components/filters/CategoryMultiSelectChips";
import { ListControlsRow } from "@/components/filters/ListControlsRow";
import { SortBottomSheet, type SortOrder } from "@/components/filters/SortBottomSheet";
import { AnchoredContextMenu, ContextMenuAnchor, type AnchoredContextMenuItem } from "@/components/ui/AnchoredContextMenu";
import { ProductExchangeBadge } from "@/components/products/ProductExchangeBadge";
import { ProductMetadata, hasExchangeHistory } from "@/components/products/ProductMetadata";
import { AppImage } from "@/components/ui/AppImage";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { useListingImagePreparationStore } from "@/lib/forms/listingImagePreparationStore";
import { uploadImages as uploadProductImages } from "@/lib/forms/listingFormUtils";
import { isProductReportedAboveThreshold } from "@/lib/listings/productReportThreshold";
import { mobileApiClient } from "@/lib/api/client";
import { syncProductEntity } from "@/lib/query/mutationSync";
import { toUploadErrorMessage } from "@/lib/uploads/presignedImageUpload";
import { ErrorView } from "@/components/ui/ErrorView";
import { EmptyView } from "@/components/ui/EmptyView";

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
 *
 * The parent may re-render due to filter changes, context menu visibility,
 * or mutations (delete/relist/unlist). Without memoization, every listing
 * card would re-render even when the product data hasn't changed, causing
 * performance drops when scrolling or filtering large product lists.
 *
 * Shallow equality works here because:
 * - item comes from useInfiniteQuery (React Query provides stable refs)
 * - Mutations and hooks are stable closures
 * - Theme comes from useAppTheme hook (stable)
 * - Router is stable from useRouter hook
 *
 * IMPACT: Scrolling/filtering remains smooth (60 FPS) even during active
 * context menu operations or mutation loading states.
 */
const ListingItem = memo(
  function ListingItem({
    item,
    router,
    theme,
    styles,
    openRequestCount,
    isPreparing,
    isActivating,
    hasUploadFailure,
    hasMissingImageLock,
    localPreviewUri,
    onContextMenuOpen,
  }: {
    item: ProductSummary;
    router: ReturnType<typeof useRouter>;
    theme: any; // AppTheme colors object
    styles: any; // StyleSheet
    openRequestCount: number;
    isPreparing: boolean;
    isActivating: boolean;
    hasUploadFailure: boolean;
    hasMissingImageLock: boolean;
    localPreviewUri: string | null;
    onContextMenuOpen: (productId: string, anchor: { left: number; top: number; bottom: number }) => void;
  }) {
    const displayOpenRequestCount = openRequestCount > OPEN_REQUEST_DISPLAY_CAP ? "10+" : `${openRequestCount}`;

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
          />
          {item.status === "ACTIVE" || item.status === "EXCHANGED" || item.status === "INACTIVE" ? (
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

        {openRequestCount > 0 ? (
          <View
            style={[
              styles.openRequestCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
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
              style={[
                styles.openRequestViewButton,
                {
                  borderColor: "#111827",
                  backgroundColor: "#111827",
                },
              ]}
            >
              <Text style={[styles.openRequestViewButtonText, { color: "#ffffff" }]}>View</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  },
);

export default function MyListingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme } = useAppTheme();
  const session = useSession();
  const deleteMutation = useDeleteProductMutation();
  const relistMutation = useRelistProductMutation();
  const unlistMutation = useUnlistProductMutation();
  const dialog = useAppDialog();
  const categoriesQuery = useCategoriesQuery();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [unlistingId, setUnlistingId] = useState<string | null>(null);
  const [retryingUploadId, setRetryingUploadId] = useState<string | null>(null);
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
  const [contextMenuProductId, setContextMenuProductId] = useState<string | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ left: number; top: number; bottom: number } | null>(null);
  const products = useProductsListController({ ownerId: session?.user.id, limit: 40 });
  const sentRequestsQuery = useRequestsQuery("sent", { limit: REQUESTS_SHARED_LIMIT });
  const receivedRequestsQuery = useRequestsQuery("received", { limit: REQUESTS_SHARED_LIMIT });
  const categories = categoriesQuery.data ?? [];
  const pendingByProductId = useListingImagePreparationStore((state) => state.pendingByProductId);
  const markPreparing = useListingImagePreparationStore((state) => state.markPreparing);
  const markActivating = useListingImagePreparationStore((state) => state.markActivating);
  const markFailed = useListingImagePreparationStore((state) => state.markFailed);
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
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

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
      if (freeOnly  && !item.isFree) {
        return false;
      }

      if (selectedTradeType === "MONEY_ONLY" && !(item.requestByMoney && !item.allowTradeRequest && !item.isFree)) {
        return false;
      }

      if (selectedTradeType === "OPEN_FOR_MONEY" && !(item.allowTradeRequest && item.requestByMoney && !item.isFree)) {
        return false;
      }

      if (selectedTradeType === "BARTER_ONLY" && !(item.allowTradeRequest && !item.requestByMoney && !item.isFree)) {
        return false;
      }

      if (
        selectedCategoryIds.length > 0 &&
        (typeof item.categoryId !== "string" || !selectedCategoryIds.includes(item.categoryId))
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${item.title} ${item.description ?? ""} ${item.category?.name ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [debouncedSearch, freeOnly, selectedCategoryIds, selectedTradeType, visibleItems]);
  const statusCounts = useMemo(() => {
    const counts: Record<ProductSummary["status"], number> = {
      ACTIVE: 0,
      INACTIVE: 0,
      RESERVED: 0,
      EXCHANGED: 0,
      REMOVED: 0,
    };

    for (const item of filteredWithoutType) {
      counts[item.status] += 1;
    }

    return counts;
  }, [filteredWithoutType]);
  const filteredItems = useMemo(() => {
    const byType =
      selectedFilter === "ALL"
        ? filteredWithoutType
        : filteredWithoutType.filter((item) => item.status === selectedFilter);

    return [...byType].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [filteredWithoutType, selectedFilter, sortBy]);
  const openRequestCountByProductId = useMemo(() => {
    const requests = receivedRequestsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const map = new Map<string, number>();

    for (const request of requests) {
      if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
        continue;
      }

      map.set(request.productId, (map.get(request.productId) ?? 0) + 1);
    }

    return map;
  }, [receivedRequestsQuery.data]);

  const contextMenuProduct = useMemo(
    () => filteredItems.find((item) => item.id === contextMenuProductId) ?? null,
    [contextMenuProductId, filteredItems],
  );

  const selectedFilterLabel = LISTING_FILTERS.find((item) => item.key === selectedFilter)?.label ?? "All";
  const selectedCategoryLabel =
    selectedCategoryIds.length === 1
      ? (categories.find((category) => category.id === selectedCategoryIds[0])?.name ?? "1 category")
      : `${selectedCategoryIds.length} categories`;
  const selectedTradeTypeLabel =
    selectedTradeType === "BARTER_ONLY"
      ? "Trade only"
      : selectedTradeType === "MONEY_ONLY"
        ? "Cash only"
        : selectedTradeType === "OPEN_FOR_MONEY"
          ? "Cash or Trade"
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
  ]
    .filter(Boolean)
    .join(" • ");

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
    ]).finally(() => {
      setIsManualRefreshing(false);
    });
  };

  const onDelete = (productId: string) => {
    void (async () => {
      const shouldDelete = await dialog.confirm(
        "Delete listing",
        "Delete this listing permanently? This action cannot be undone.",
        {
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          destructive: true,
        },
      );

      if (!shouldDelete) {
        return;
      }

      setDeletingId(productId);
      deleteMutation
        .mutateAsync(productId)
        .catch((error) => {
          void dialog.alert("Delete failed", toErrorMessage(error));
        })
        .finally(() => {
          setDeletingId(null);
        });
    })();
  };

  const onUnlist = (productId: string) => {
    void (async () => {
      const shouldUnlist = await dialog.confirm(
        "Unlist product",
        "Remove this listing from the marketplace? You can relist it later.",
        {
          confirmLabel: "Unlist",
          cancelLabel: "Cancel",
          destructive: true,
        },
      );

      if (!shouldUnlist) {
        return;
      }

      setUnlistingId(productId);
      unlistMutation
        .mutateAsync(productId)
        .catch((error) => {
          void dialog.alert("Unlist failed", toUnlistErrorMessage(error));
        })
        .finally(() => {
          setUnlistingId(null);
        });
    })();
  };

  const onRelist = (productId: string) => {
    void (async () => {
      const shouldRelist = await dialog.confirm(
        "Relist product",
        "Relist this product? It will become ACTIVE and visible to buyers.",
        {
          confirmLabel: "Relist",
          cancelLabel: "Cancel",
        },
      );

      if (!shouldRelist) {
        return;
      }

      setRelistingId(productId);
      relistMutation
        .mutateAsync(productId)
        .catch((error) => {
          void dialog.alert("Relist failed", toRelistErrorMessage(error));
        })
        .finally(() => {
          setRelistingId(null);
        });
    })();
  };

  const onRetryImageUpload = (productId: string) => {
    if (retryingUploadId === productId) {
      return;
    }

    const prepState = pendingByProductId[productId];
    const retryAssets = prepState?.retryAssets ?? [];

    if (retryAssets.length === 0) {
      void dialog.alert(
        "Retry unavailable",
        "The original local image is no longer available. Open Edit and add image again.",
      );
      return;
    }

    setRetryingUploadId(productId);
    markPreparing(productId, prepState?.localPreviewUri ?? retryAssets[0]?.uri ?? null, retryAssets);

    void (async () => {
      try {
        await uploadProductImages(productId, retryAssets, (index) => index === 0);
        markActivating(productId);

        const relistedEnvelope = await mobileApiClient.relistProduct(productId);
        if (relistedEnvelope.data) {
          syncProductEntity(queryClient, relistedEnvelope.data);
        } else {
          const refreshed = await mobileApiClient.getProductById(productId);
          if (refreshed.data) {
            syncProductEntity(queryClient, refreshed.data);
          }
        }

        clearPreparing(productId);
      } catch (error) {
        markFailed(productId);
        void dialog.alert("Retry failed", toUploadErrorMessage(error, toRelistErrorMessage));
      } finally {
        setRetryingUploadId((current) => (current === productId ? null : current));
      }
    })();
  };

  const contextMenuItems = useMemo(() => {
    if (!contextMenuProductId) {
      return [];
    }

    const prepState = pendingByProductId[contextMenuProductId];
    const canRetryUpload = prepState?.phase === "failed";

    const items: AnchoredContextMenuItem[] = [];

    if (canRetryUpload) {
      items.push({
        key: "retry-image-upload",
        label: retryingUploadId === contextMenuProductId ? "Retrying image upload..." : "Retry image upload",
        icon: "refresh-cw",
        onPress: () => {
          onRetryImageUpload(contextMenuProductId);
        },
      });
    }

    items.push(
      {
        key: "edit",
        label: "Edit",
        icon: "edit",
        onPress: () => {
          router.push({
            pathname: "/(app)/listings/[id]/edit",
            params: { id: contextMenuProductId, returnTo: "my-listings" },
          });
        },
      },
    );

    if (contextMenuProduct && !isProductReportedAboveThreshold(contextMenuProduct)) {
      items.push({
        key: "toggle-listing",
        label: contextMenuProduct.status === "ACTIVE" ? "Unlist" : "Relist",
        icon: contextMenuProduct.status === "ACTIVE" ? "eye-off" : "eye",
        onPress: () => {
          if (contextMenuProduct.status === "ACTIVE") {
            onUnlist(contextMenuProductId);
            return;
          }

          onRelist(contextMenuProductId);
        },
      });
    }

    items.push({
      key: "delete",
      label: "Delete",
      icon: "trash-2",
      destructive: true,
      dividerTop: true,
      onPress: () => {
        onDelete(contextMenuProductId);
      },
    });

    return items;
  }, [
    contextMenuProduct,
    contextMenuProductId,
    onRetryImageUpload,
    pendingByProductId,
    retryingUploadId,
    router,
  ]);

  if (!session || products.query.isPending) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <ProductListLoadingState spinnerSize={30} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      {products.query.error ? (
        <ErrorView
          title="Could not load your listing"
          message="Something went wrong. Please try again."
          buttons={[
            {
              label: 'Retry',
              onPress: () => void products.refresh(),
            },
          ]}
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
                  <View style={[
                    styles.headerMetaCountPill,
                  ]}>
                    <Text style={[styles.headerMetaCountText, { color: theme.colors.textPrimary }]}>
                      {filteredItems.length}
                    </Text>
                    <Text style={[styles.headerMetaCountLabel, { color: theme.colors.textMuted }]}>
                      {(filteredItems.length === 1 || filteredItems.length === 0) ? "listing" : "listings"}
                    </Text>
                  </View>
                  <Text style={[styles.headerMetaSummaryText, { color: theme.colors.textMuted }]} numberOfLines={2}>
                    {selectedFilterSummary || "Showing all listings"}
                  </Text>
                </View>
              }
            >
              <View style={{ marginTop: 10 }}>
                <Input
                  label=""
                  placeholder="Try bicycle, books, guitar..."
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

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isManualRefreshing} onRefresh={onManualRefresh} />
            }
            onEndReachedThreshold={0.35}
            onEndReached={products.loadMore}
            ListEmptyComponent={
              <EmptyView
                title={
                  selectedFilter === 'ALL' 
                    ? "You haven't listed yet."
                    : `No ${selectedFilterLabel.toLowerCase()} listings found.`
                }
                message={
                  selectedFilter === 'ALL'
                    ? "Create listing and it will show up here."
                    : "Try adjusting your filters to see more results."
                }
                buttons={
                  selectedFilter === 'ALL'
                    ? [{label: "Create listing", onPress: () => router.push("/(app)/(tabs)/create")}]
                    : undefined
                }
              />
            }
            ListFooterComponent={
              products.query.isFetchingNextPage ? (
                <ProductListFooterLoadingState />
              ) : showListingsEndMessage ? (
                <View style={styles.endListWrap}>
                  <Text style={[styles.endListText, { color: theme.colors.textMuted }]}>All caught up. Your listings have no secret bottom level.</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const imagePreparation = pendingByProductId[item.id];
              const hasNoServerImage = (item.productImages?.length ?? 0) === 0;
              const isPreparing =
                imagePreparation?.phase === "uploading" && hasNoServerImage;
              const isActivating = imagePreparation?.phase === "activating";
              const hasUploadFailure = imagePreparation?.phase === "failed" && hasNoServerImage;
              const hasMissingImageLock =
                item.status === "INACTIVE" &&
                hasNoServerImage &&
                !isPreparing &&
                !hasUploadFailure;

              return (
                <ListingItem
                  item={item}
                  router={router}
                  theme={theme}
                  styles={styles}
                  openRequestCount={openRequestCountByProductId.get(item.id) ?? 0}
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
        <Pressable
          style={[styles.sortBackdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            style={[
              styles.sortSheet,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={() => {
              // Keep sheet open when tapping inside.
            }}
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

                  if(count === 0 && filter.key !== "ALL") {
                    return null;
                  }

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
                  active={draftTradeType === "MONEY_ONLY"}
                  label="Cash only"
                  onPress={() => setDraftTradeType("MONEY_ONLY")}
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
                  setDraftFilter("ALL");
                  setDraftCategoryIds([]);
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
                onPress={onApplyFilter}
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
    </SafeAreaView>
  );
}

function ListingPreview({
  product,
  isPreparing = false,
  isActivating = false,
  hasUploadFailure = false,
  hasMissingImageLock = false,
  localPreviewUri = null,
}: {
  product: ProductSummary;
  isPreparing?: boolean;
  isActivating?: boolean;
  hasUploadFailure?: boolean;
  hasMissingImageLock?: boolean;
  localPreviewUri?: string | null;
}) {
  const { theme } = useAppTheme();
  const primaryImage = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0];
  const displayImageUri = primaryImage?.url ?? localPreviewUri;
  const isLive = product.status === "ACTIVE";

  return (
    <View style={styles.previewWrap}>
      <View style={styles.imageWrap}>
        {displayImageUri ? (
          <>
            <AppImage
              uri={displayImageUri}
              style={styles.image}
            />
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
                backgroundColor: isLive ? "#dcfce7" : theme.colors.surfaceMuted,
                borderColor: isLive ? "#86efac" : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isLive ? "#15803d" : theme.colors.textMuted },
              ]}
            >
              {product.status}
            </Text>
          </View>
        </View>

        <View style={styles.previewTagsWrap}>
          <ProductMetadata
            product={product}
            variant="compact"
            showCategory={false}
            showLocation={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fixedTopContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 110 },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerMetaCountPill: {
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
    minWidth: 0,
    flex: 1,
    lineHeight: 18,
    flexShrink: 1,
    textAlign: "right",
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
  sortBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sortSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 10,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  filterSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  filterOptionsWrap: {
    gap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  filterActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardBody: {
    position: "relative",
  },
  previewWrap: {
    padding: 10,
    gap: 10,
  },
  imageWrap: {
    width: "100%",
    height: 168,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageStatusOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  imageStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  imageStatusSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  imageFallbackText: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewContent: {
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  previewTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    fontWeight: "800",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewDesc: {
    fontSize: 14,
    lineHeight: 19,
  },
  previewTagsWrap: {
    marginTop: 4,
  },
  openRequestCard: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  openRequestInfoWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  openRequestCardTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  openRequestCardSubtitle: {
    fontSize: 12,
  },
  openRequestViewButton: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  openRequestViewButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  editIconButton: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorWrap: {
    margin: 16,
  },
});
