import { FlatList, Image, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { ProductSummary, RequestStatus } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
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
  ProductListEmptyState,
  ProductListErrorState,
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { ProductExchangeBadge } from "@/components/products/ProductExchangeBadge";
import { ProductMetadata, hasExchangeHistory } from "@/components/products/ProductMetadata";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppDialog } from "@/providers/AppDialogProvider";

type ListingFilter = "ALL" | ProductSummary["status"];

const LISTING_FILTERS: Array<{ key: ListingFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "RESERVED", label: "Reserved" },
  { key: "EXCHANGED", label: "Exchanged" },
];

const OPEN_REQUEST_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING", "ACCEPTED"];

export default function MyListingsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const session = useSession();
  const deleteMutation = useDeleteProductMutation();
  const relistMutation = useRelistProductMutation();
  const unlistMutation = useUnlistProductMutation();
  const dialog = useAppDialog();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [unlistingId, setUnlistingId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ListingFilter>("ALL");
  const [draftFilter, setDraftFilter] = useState<ListingFilter>("ALL");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const products = useProductsListController({ ownerId: session?.user.id, limit: 20 });
  const receivedRequestsQuery = useRequestsQuery("received", { limit: 100 });
  const visibleItems = useMemo(
    () => products.items.filter((item) => item.status !== "REMOVED"),
    [products.items],
  );
  const statusCounts = useMemo(() => {
    const counts: Record<ProductSummary["status"], number> = {
      ACTIVE: 0,
      INACTIVE: 0,
      RESERVED: 0,
      EXCHANGED: 0,
      REMOVED: 0,
    };

    for (const item of visibleItems) {
      counts[item.status] += 1;
    }

    return counts;
  }, [visibleItems]);
  const filteredItems = useMemo(() => {
    if (selectedFilter === "ALL") {
      return visibleItems;
    }

    return visibleItems.filter((item) => item.status === selectedFilter);
  }, [visibleItems, selectedFilter]);
  const openRequestByProductId = useMemo(() => {
    const requests = receivedRequestsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const map = new Map<string, { requestId: string; status: RequestStatus; count: number; updatedAtMs: number }>();

    for (const request of requests) {
      if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
        continue;
      }

      const existing = map.get(request.productId);
      const nextUpdatedAtMs = new Date(request.updatedAt).getTime();
      if (!existing) {
        map.set(request.productId, {
          requestId: request.id,
          status: request.status,
          count: 1,
          updatedAtMs: nextUpdatedAtMs,
        });
        continue;
      }

      if (nextUpdatedAtMs > existing.updatedAtMs) {
        map.set(request.productId, {
          requestId: request.id,
          status: request.status,
          count: existing.count + 1,
          updatedAtMs: nextUpdatedAtMs,
        });
      } else {
        map.set(request.productId, {
          ...existing,
          count: existing.count + 1,
        });
      }
    }

    return map;
  }, [receivedRequestsQuery.data]);
  const selectedFilterLabel = LISTING_FILTERS.find((item) => item.key === selectedFilter)?.label ?? "All";

  const onOpenFilterPicker = () => {
    setDraftFilter(selectedFilter);
    setShowFilterModal(true);
  };

  const onApplyFilter = () => {
    setSelectedFilter(draftFilter);
    setShowFilterModal(false);
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
        <View style={styles.errorWrap}>
          <ProductListErrorState
            message="Could not load your listings. Please try again."
            onRetry={products.refresh}
          />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={products.query.isRefetching} onRefresh={products.refresh} />
          }
          onEndReachedThreshold={0.35}
          onEndReached={products.loadMore}
          ListHeaderComponent={
            <View style={[styles.headerCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>My Listings</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                You currently have {visibleItems.length} visible listings.
              </Text>
              <View style={styles.filterWrap}>
                <Text style={[styles.filterLabel, { color: theme.colors.textMuted }]}>Filter by type</Text>
                <Pressable
                  onPress={onOpenFilterPicker}
                  style={[
                    styles.controlButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <Feather name="sliders" size={15} color={theme.colors.textSecondary} />
                  <Text style={[styles.controlButtonText, { color: theme.colors.textPrimary }]}>Type: {selectedFilterLabel}</Text>
                  {selectedFilter !== "ALL" ? (
                    <View style={[styles.activeCountPill, { backgroundColor: theme.colors.primary }]}> 
                      <Text style={[styles.activeCountText, { color: theme.colors.onPrimary }]}>1</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <ProductListEmptyState
              message={
                selectedFilter === "ALL"
                  ? "You do not have any listings yet."
                  : `No ${selectedFilter.toLowerCase()} listings found.`
              }
            />
          }
          ListFooterComponent={
            products.query.isFetchingNextPage ? <ProductListFooterLoadingState /> : null
          }
          renderItem={({ item }) => (
            <View style={[styles.itemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/products/[id]",
                    params: { id: item.id, backTo: "my-listings" },
                  })
                }
                style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.95 : 1 }]}
              >
                <ListingPreview
                  product={item}
                  openRequest={openRequestByProductId.get(item.id)}
                  onOpenRequest={(requestId) => router.push(`/(app)/requests/${requestId}`)}
                />
                {(item.status === "ACTIVE" || item.status === "EXCHANGED" || item.status === "INACTIVE") ? (
                  <Pressable
                    style={[
                      styles.editIconButton,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                      hasExchangeHistory(item) && styles.editIconButtonBelowBadge,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/listings/[id]/edit",
                        params: { id: item.id, returnTo: "my-listings" },
                      })
                    }
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={16} color={theme.colors.textPrimary} />
                  </Pressable>
                ) : null}
              </Pressable>
              <View style={[styles.actionBar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                {item.status === "ACTIVE" && (
                  <Pressable
                    style={[styles.actionBtn, { borderRightColor: theme.colors.border }]}
                    onPress={() => onUnlist(item.id)}
                    disabled={Boolean(unlistingId) && unlistingId !== item.id}
                  >
                    <Text style={[
                      styles.actionBtnText,
                      { color: theme.colors.textSecondary },
                      unlistingId === item.id && unlistMutation.isPending && styles.actionBtnLoading,
                    ]}>
                      {unlistingId === item.id && unlistMutation.isPending ? "Unlisting…" : "Unlist"}
                    </Text>
                  </Pressable>
                )}
                {(item.status === "EXCHANGED" || item.status === "REMOVED" || item.status === "INACTIVE") && (
                  <Pressable
                    style={[styles.actionBtn, { borderRightColor: theme.colors.border }]}
                    onPress={() => onRelist(item.id)}
                    disabled={Boolean(relistingId) && relistingId !== item.id}
                  >
                    <Text style={[
                      styles.actionBtnText,
                      { color: theme.colors.textSecondary },
                      relistingId === item.id && relistMutation.isPending && styles.actionBtnLoading,
                    ]}>
                      {relistingId === item.id && relistMutation.isPending ? "Relisting…" : "Relist"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionBtnRight,
                    { borderRightColor: theme.colors.border },
                  ]}
                  onPress={() => onDelete(item.id)}
                  disabled={Boolean(deletingId) && deletingId !== item.id}
                >
                  <Text style={[
                    styles.actionBtnText,
                    styles.actionBtnTextDestructive,
                    deletingId === item.id && deleteMutation.isPending && styles.actionBtnLoading,
                  ]}>
                    {deletingId === item.id && deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
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

            {LISTING_FILTERS.map((filter) => {
              const count =
                filter.key === "ALL"
                  ? visibleItems.length
                  : statusCounts[filter.key as ProductSummary["status"]];

              return (
                <Pressable
                  key={filter.key}
                  style={[
                    styles.sortOption,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: draftFilter === filter.key ? theme.colors.surfaceMuted : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setDraftFilter(filter.key)}
                >
                  <Text style={[styles.sortOptionLabel, { color: theme.colors.textPrimary }]}>{filter.label} ({count})</Text>
                  {draftFilter === filter.key ? (
                    <Feather name="check" size={16} color={theme.colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}

            <View style={styles.filterActionsRow}>
              <Pressable
                style={[
                  styles.filterActionButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                ]}
                onPress={() => setDraftFilter("ALL")}
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
    </SafeAreaView>
  );
}

function ListingPreview({
  product,
  openRequest,
  onOpenRequest,
}: {
  product: ProductSummary;
  openRequest?: { requestId: string; status: RequestStatus; count: number };
  onOpenRequest: (requestId: string) => void;
}) {
  const { theme } = useAppTheme();
  const primaryImage = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0];
  const isLive = product.status === "ACTIVE";

  return (
    <View style={styles.previewWrap}>
      <View style={styles.imageWrap}>
        {primaryImage ? (
          <>
            <Image source={{ uri: primaryImage.url }} style={styles.image} resizeMode="cover" />
            {hasExchangeHistory(product) ? <ProductExchangeBadge /> : null}
          </>
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Text style={[styles.imageFallbackText, { color: theme.colors.textMuted }]}>No image available</Text>
            {hasExchangeHistory(product) ? <ProductExchangeBadge /> : null}
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

        <Text style={[styles.previewDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {product.description || "No description added yet."}
        </Text>

        {openRequest ? (
          <Pressable
            onPress={() => onOpenRequest(openRequest.requestId)}
            style={[styles.openRequestPill, { borderColor: theme.colors.primary, backgroundColor: theme.colors.chipActiveBg }]}
          >
            <Feather name="inbox" size={13} color={theme.colors.chipActiveText} />
            <Text style={[styles.openRequestPillText, { color: theme.colors.chipActiveText }]}> 
              Open request {openRequest.count > 1 ? `(${openRequest.count})` : ""} - {openRequest.status}
            </Text>
          </Pressable>
        ) : null}

        <ProductMetadata
          product={product}
          variant="compact"
          showCategory={false}
          showLocation={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 110 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14 },
  filterWrap: {
    marginTop: 4,
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  controlButton: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  activeCountPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCountText: {
    fontSize: 11,
    fontWeight: "700",
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
  sortOption: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortOptionLabel: {
    fontSize: 14,
    fontWeight: "700",
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
  openRequestPill: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 999,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openRequestPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  editIconButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editIconButtonBelowBadge: {
    // badge is top:8, ~26px tall + 8px gap = clear at top:42
    top: 50,
  },
  actionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
  },
  actionBtnRight: {
    borderRightWidth: 0,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionBtnTextDestructive: {
    color: "#ef4444",
  },
  actionBtnLoading: {
    opacity: 0.5,
  },
  errorWrap: {
    margin: 16,
  },
});
