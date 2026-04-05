import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ProductSummary, RequestStatus, RequestSummary, RequestTurn } from "@barter/types";
import { StatusBar } from "expo-status-bar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";
import { ListControlsRow } from "@/components/filters/ListControlsRow";
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useCreateCounterOfferMutation,
  useRejectRequestMutation,
  toErrorMessage as toRequestErrorMessage,
} from "@/hooks/mutations/useRequestMutations";
import { useActiveTransactionQuery } from "@/hooks/queries/useActiveTransactionQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";

const OPEN_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING"];
const ALL_PRODUCTS_FILTER = "__ALL_PRODUCTS__";

type ProductRequestGroup = {
  productId: string;
  productTitle: string;
  requests: RequestSummary[];
  latestUpdatedAtMs: number;
};

function buildProductRequestGroups(items: RequestSummary[]) {
  const map = new Map<string, ProductRequestGroup>();

  for (const item of items) {
    const current = map.get(item.productId);
    const updatedAtMs = new Date(item.updatedAt).getTime();

    if (!current) {
      map.set(item.productId, {
        productId: item.productId,
        productTitle: item.product.title,
        requests: [item],
        latestUpdatedAtMs: updatedAtMs,
      });
      continue;
    }

    current.requests.push(item);
    current.latestUpdatedAtMs = Math.max(current.latestUpdatedAtMs, updatedAtMs);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      requests: [...group.requests].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    }))
    .sort((a, b) => b.latestUpdatedAtMs - a.latestUpdatedAtMs);
}

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "PENDING": return { bg: "#fef3c7", text: "#b45309" };
    case "NEGOTIATING": return { bg: "#dbeafe", text: "#1d4ed8" };
    case "ACCEPTED": return { bg: "#dcfce7", text: "#15803d" };
    case "REJECTED": return { bg: "#fee2e2", text: "#b91c1c" };
    case "CANCELLED": return { bg: "#f1f5f9", text: "#64748b" };
    case "COMPLETED": return { bg: "#ccfbf1", text: "#0f766e" };
    default: return { bg: "#e2e8f0", text: "#334155" };
  }
}

export default function RequestsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; productId?: string }>();
  const { theme, statusBarStyle } = useAppTheme();
  const session = useSession();
  const sentQuery = useRequestsQuery("sent", { limit: 20 });
  const receivedQuery = useRequestsQuery("received", { limit: 20 });
  const ownProducts = useProductsListController({
    ownerId: session?.user.id,
    status: "ACTIVE",
    limit: 60,
  });

  const acceptMutation = useAcceptRequestMutation();
  const rejectMutation = useRejectRequestMutation();
  const cancelMutation = useCancelRequestMutation();
  const counterOfferMutation = useCreateCounterOfferMutation();

  const sentItems = sentQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedItems = receivedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedGroups = useMemo(() => buildProductRequestGroups(receivedItems), [receivedItems]);
  const sentGroups = useMemo(() => buildProductRequestGroups(sentItems), [sentItems]);
  const ownOfferableProducts = ownProducts.items;
  const [activeTab, setActiveTab] = useState<"received" | "sent">(
    params.tab === "sent" ? "sent" : "received",
  );
  const [selectedProductByTab, setSelectedProductByTab] = useState<{
    received: string;
    sent: string;
  }>({
    received: ALL_PRODUCTS_FILTER,
    sent: ALL_PRODUCTS_FILTER,
  });
  const [showProductFilterModal, setShowProductFilterModal] = useState(false);
  const [draftProductFilter, setDraftProductFilter] = useState(ALL_PRODUCTS_FILTER);
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  const lastNonEmptyTabOptionsRef = useRef<Array<{ value: "received" | "sent"; label: string }>>([]);
  const lastAppliedParamKeyRef = useRef<string | null>(null);
  const hasReceivedItems = receivedItems.length > 0;
  const hasSentItems = sentItems.length > 0;
  const isInitialLoading =
    (sentQuery.isPending && sentQuery.data == null && !sentQuery.error) ||
    (receivedQuery.isPending && receivedQuery.data == null && !receivedQuery.error);

  const tabOptions = useMemo(
    () => {
      const next: Array<{ value: "received" | "sent"; label: string }> = [];
      if (hasReceivedItems) {
        next.push({ value: "received", label: `Received (${receivedItems.length})` });
      }
      if (hasSentItems) {
        next.push({ value: "sent", label: `Sent (${sentItems.length})` });
      }
      return next;
    },
    [hasReceivedItems, hasSentItems, receivedItems.length, sentItems.length],
  );

  useEffect(() => {
    if (tabOptions.length > 0) {
      lastNonEmptyTabOptionsRef.current = tabOptions;
    }
  }, [tabOptions]);

  const stableTabOptions =
    tabOptions.length === 0 &&
    (sentQuery.isPending || receivedQuery.isPending || sentQuery.isFetching || receivedQuery.isFetching)
      ? lastNonEmptyTabOptionsRef.current
      : tabOptions;

  useEffect(() => {
    if (receivedQuery.isPending || sentQuery.isPending || stableTabOptions.length === 0) {
      return;
    }

    const hasCurrentTab = stableTabOptions.some((option) => option.value === activeTab);
    if (!hasCurrentTab) {
      setActiveTab(stableTabOptions[0].value);
    }
  }, [
    activeTab,
    receivedQuery.isPending,
    sentQuery.isPending,
    stableTabOptions,
  ]);

  const isEverythingEmpty =
    !sentQuery.isPending &&
    !receivedQuery.isPending &&
    !sentQuery.error &&
    !receivedQuery.error &&
    sentItems.length === 0 &&
    receivedItems.length === 0;

  const currentGroups = activeTab === "received" ? receivedGroups : sentGroups;
  const selectedProductId = activeTab === "received" ? selectedProductByTab.received : selectedProductByTab.sent;
  const filteredGroups = useMemo(() => {
    if (selectedProductId === ALL_PRODUCTS_FILTER) {
      return currentGroups;
    }

    return currentGroups.filter((group) => group.productId === selectedProductId);
  }, [currentGroups, selectedProductId]);
  const productFilterOptions = useMemo(
    () => [
      {
        value: ALL_PRODUCTS_FILTER,
        label: "All products",
        count: currentGroups.reduce((sum, group) => sum + group.requests.length, 0),
      },
      ...currentGroups.map((group) => ({
        value: group.productId,
        label: group.productTitle,
        count: group.requests.length,
      })),
    ],
    [currentGroups],
  );
  const selectedProductLabel =
    productFilterOptions.find((option) => option.value === selectedProductId)?.label ?? "All products";
  const requestFilterActiveCount = selectedProductId === ALL_PRODUCTS_FILTER ? 0 : 1;

  useEffect(() => {
    const requestedProductId = typeof params.productId === "string" ? params.productId : null;
    if (!requestedProductId) {
      return;
    }

    const tab = params.tab === "sent" ? "sent" : "received";
    const paramKey = `${tab}:${requestedProductId}`;
    if (lastAppliedParamKeyRef.current === paramKey) {
      return;
    }

    const hasRequestedProduct = (tab === "sent" ? sentGroups : receivedGroups).some(
      (group) => group.productId === requestedProductId,
    );

    if (!hasRequestedProduct) {
      return;
    }

    setActiveTab(tab);
    setSelectedProductByTab((prev) => ({
      ...prev,
      [tab]: requestedProductId,
    }));
    lastAppliedParamKeyRef.current = paramKey;
  }, [params.productId, params.tab, receivedGroups, sentGroups]);

  useEffect(() => {
    setIsViewTransitioning(true);
    const timer = setTimeout(() => setIsViewTransitioning(false), 180);
    return () => clearTimeout(timer);
  }, [activeTab, selectedProductByTab.received, selectedProductByTab.sent]);

  const onOpenProductFilter = () => {
    setDraftProductFilter(selectedProductId);
    setShowProductFilterModal(true);
  };

  const onApplyProductFilter = () => {
    setSelectedProductByTab((prev) => ({
      ...prev,
      [activeTab]: draftProductFilter,
    }));
    setShowProductFilterModal(false);
  };

  const onRefreshAll = () => {
    void Promise.all([
      sentQuery.refetch(),
      receivedQuery.refetch(),
      ownProducts.query.refetch(),
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.screen}>
        <View style={styles.fixedTopContent}>
        <PageHeaderCard
          title="Requests"
          subtitle="Manage incoming and outgoing negotiations."
          style={styles.headerCard}
        />

        {!isInitialLoading && stableTabOptions.length > 0 ? (
          <View style={[styles.tabsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <SegmentedControl
              value={activeTab}
              options={stableTabOptions}
              onChange={setActiveTab}
            />
          </View>
        ) : null}

        {isInitialLoading ? (
          <View style={[styles.emptyCardGlobal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Spinner size={20} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>Loading requests...</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>Fetching latest received and sent requests.</Text>
          </View>
        ) : null}

        </View>

        <View style={styles.scrollArea}>
          {!isInitialLoading && isEverythingEmpty ? (
            <ScrollView
              contentContainerStyle={styles.scrollAreaContent}
              refreshControl={
                <RefreshControl
                  refreshing={
                    sentQuery.isRefetching || receivedQuery.isRefetching || ownProducts.query.isRefetching
                  }
                  onRefresh={onRefreshAll}
                />
              }
              keyboardDismissMode="on-drag"
            >
              <View style={[styles.emptyCardGlobal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                <Feather name="inbox" size={20} color={theme.colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No requests right now</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>Once someone sends or receives an offer, it will appear here.</Text>
              </View>
            </ScrollView>
          ) : null}

          {!isInitialLoading && !isEverythingEmpty && activeTab === "received" ? (
            <RequestSection
              title="Received"
              actorTurn="SELLER"
              router={router}
              groups={filteredGroups}
              isPending={receivedQuery.isPending}
              isError={Boolean(receivedQuery.error)}
              onRetry={() => void receivedQuery.refetch()}
              hasNextPage={Boolean(receivedQuery.hasNextPage)}
              loadingNext={receivedQuery.isFetchingNextPage}
              onLoadMore={() => void receivedQuery.fetchNextPage()}
              selectedProductLabel={selectedProductLabel}
              activeFilterCount={requestFilterActiveCount}
              onOpenFilter={onOpenProductFilter}
              acceptMutation={acceptMutation}
              rejectMutation={rejectMutation}
              cancelMutation={cancelMutation}
              counterOfferMutation={counterOfferMutation}
              sessionUserId={session?.user.id ?? ""}
              ownOfferableProducts={ownOfferableProducts}
              isRefreshing={sentQuery.isRefetching || receivedQuery.isRefetching || ownProducts.query.isRefetching}
              onRefresh={onRefreshAll}
            />
          ) : null}

          {!isInitialLoading && !isEverythingEmpty && activeTab === "sent" ? (
            <RequestSection
              title="Sent"
              actorTurn="BUYER"
              router={router}
              groups={filteredGroups}
              isPending={sentQuery.isPending}
              isError={Boolean(sentQuery.error)}
              onRetry={() => void sentQuery.refetch()}
              hasNextPage={Boolean(sentQuery.hasNextPage)}
              loadingNext={sentQuery.isFetchingNextPage}
              onLoadMore={() => void sentQuery.fetchNextPage()}
              selectedProductLabel={selectedProductLabel}
              activeFilterCount={requestFilterActiveCount}
              onOpenFilter={onOpenProductFilter}
              acceptMutation={acceptMutation}
              rejectMutation={rejectMutation}
              cancelMutation={cancelMutation}
              counterOfferMutation={counterOfferMutation}
              sessionUserId={session?.user.id ?? ""}
              ownOfferableProducts={ownOfferableProducts}
              isRefreshing={sentQuery.isRefetching || receivedQuery.isRefetching || ownProducts.query.isRefetching}
              onRefresh={onRefreshAll}
            />
          ) : null}
        </View>

        <Modal
          visible={showProductFilterModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProductFilterModal(false)}
        >
          <Pressable
            style={[styles.filterModalBackdrop, { backgroundColor: theme.colors.overlay }]}
            onPress={() => setShowProductFilterModal(false)}
          >
            <Pressable
              style={[
                styles.filterModalSheet,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              onPress={() => {
                // Keep modal open when tapping inside.
              }}
            >
              <View style={styles.filterModalHeaderRow}>
                <Text style={[styles.filterModalTitle, { color: theme.colors.textPrimary }]}>Filter by product</Text>
                <Pressable onPress={() => setShowProductFilterModal(false)}>
                  <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              </View>

              {productFilterOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.filterOption,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor:
                        draftProductFilter === option.value ? theme.colors.surfaceMuted : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setDraftProductFilter(option.value)}
                >
                  <Text style={[styles.filterOptionText, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {option.label} ({option.count})
                  </Text>
                  {draftProductFilter === option.value ? (
                    <Feather name="check" size={16} color={theme.colors.primary} />
                  ) : null}
                </Pressable>
              ))}

              <View style={styles.filterActionRow}>
                <Pressable
                  style={[
                    styles.filterActionBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                  onPress={() => setDraftProductFilter(ALL_PRODUCTS_FILTER)}
                >
                  <Text style={[styles.filterActionText, { color: theme.colors.textSecondary }]}>Clear</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.filterActionBtn,
                    {
                      borderColor: theme.colors.primary,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                  onPress={onApplyProductFilter}
                >
                  <Text style={[styles.filterActionText, { color: theme.colors.onPrimary }]}>Apply</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function RequestSection({
  title,
  actorTurn,
  router,
  groups,
  isPending,
  isError,
  onRetry,
  hasNextPage,
  loadingNext,
  onLoadMore,
  selectedProductLabel,
  activeFilterCount,
  onOpenFilter,
  isRefreshing,
  onRefresh,
  acceptMutation,
  rejectMutation,
  cancelMutation,
  counterOfferMutation,
  sessionUserId,
  ownOfferableProducts,
}: {
  title: string;
  actorTurn: RequestTurn;
  router: ReturnType<typeof useRouter>;
  groups: ProductRequestGroup[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasNextPage: boolean;
  loadingNext: boolean;
  onLoadMore: () => void;
  selectedProductLabel: string;
  activeFilterCount: number;
  onOpenFilter: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  acceptMutation: ReturnType<typeof useAcceptRequestMutation>;
  rejectMutation: ReturnType<typeof useRejectRequestMutation>;
  cancelMutation: ReturnType<typeof useCancelRequestMutation>;
  counterOfferMutation: ReturnType<typeof useCreateCounterOfferMutation>;
  sessionUserId: string;
  ownOfferableProducts: ProductSummary[];
}) {
  const { theme } = useAppTheme();
  const flattenedRows = useMemo(() => {
    return groups.flatMap((group, groupIndex) => [
      {
        kind: "header" as const,
        key: `${group.productId}-header`,
        group,
        groupIndex,
      },
      ...group.requests.map((item) => ({
        kind: "item" as const,
        key: item.id,
        item,
      })),
    ]);
  }, [groups]);

  const stickyHeaderIndices = useMemo(() => {
    return flattenedRows
      .map((row, index) => (row.kind === "header" ? index : -1))
      .filter((index) => index !== -1);
  }, [flattenedRows]);

  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
        <ListControlsRow
          activeFilterCount={activeFilterCount}
          freeOnly={false}
          onOpenFilters={onOpenFilter}
          showSort={false}
          showFree={false}
        />
      </View>

      {isPending ? (
        <View style={styles.loadingWrap}>
          <Spinner size={20} />
        </View>
      ) : null}

      {isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Could not load {title.toLowerCase()} requests.</Text>
          <Button label="Retry" onPress={onRetry} />
        </View>
      ) : null}

      {!isPending && !isError && groups.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}> 
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No {title.toLowerCase()} requests for {selectedProductLabel.toLowerCase()}.</Text>
        </View>
      ) : null}

      {!isPending && !isError && groups.length > 0 ? (
        <View style={styles.listWrapFlatlist}>
          <FlatList<typeof flattenedRows[0]>
            style={styles.sectionScroll}
            contentContainerStyle={styles.sectionScrollContent}
            data={flattenedRows}
            keyExtractor={(item) => item.key}
            stickyHeaderIndices={stickyHeaderIndices}
            scrollEnabled={true}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: row }) =>
              row.kind === "header" ? (
                <View
                  style={[
                    styles.productGroupHeader,
                    {
                      borderBottomColor: theme.colors.border,
                      borderTopColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                    row.groupIndex > 0 ? styles.productGroupHeaderWithTopBorder : undefined,
                  ]}
                >
                  <Text style={[styles.productGroupTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {row.group.productTitle}
                  </Text>
                  <Text style={[styles.productGroupCount, { color: theme.colors.textMuted }]}>
                    {row.group.requests.length} request(s)
                  </Text>
                </View>
              ) : (
                <RequestItem
                  item={row.item}
                  router={router}
                  actorTurn={actorTurn}
                  acceptMutation={acceptMutation}
                  rejectMutation={rejectMutation}
                  cancelMutation={cancelMutation}
                  counterOfferMutation={counterOfferMutation}
                  sessionUserId={sessionUserId}
                  ownOfferableProducts={ownOfferableProducts}
                />
              )
            }
            ListFooterComponent={
              hasNextPage ? (
                <Button label="Load more" variant="ghost" loading={loadingNext} onPress={onLoadMore} />
              ) : null
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function RequestItem({
  item,
  router,
  actorTurn,
  acceptMutation,
  rejectMutation,
  cancelMutation,
  counterOfferMutation,
  sessionUserId,
  ownOfferableProducts,
}: {
  item: RequestSummary;
  router: ReturnType<typeof useRouter>;
  actorTurn: RequestTurn;
  acceptMutation: ReturnType<typeof useAcceptRequestMutation>;
  rejectMutation: ReturnType<typeof useRejectRequestMutation>;
  cancelMutation: ReturnType<typeof useCancelRequestMutation>;
  counterOfferMutation: ReturnType<typeof useCreateCounterOfferMutation>;
  sessionUserId: string;
  ownOfferableProducts: ProductSummary[];
}) {
  const { theme } = useAppTheme();
  const activeTransactionQuery = useActiveTransactionQuery(
    item.id,
    item.status === "ACCEPTED" && item.product.status !== "EXCHANGED",
  );
  const [txFeedback, setTxFeedback] = useState<string | null>(null);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterOfferType, setCounterOfferType] = useState<"PRODUCT" | "MONEY" | "MIXED" | "NONE">(
    item.product.isFree ? "NONE" : item.product.requestByMoney ? "MONEY" : "PRODUCT",
  );
  const [counterAmount, setCounterAmount] = useState("");
  const [counterOfferedProductIds, setCounterOfferedProductIds] = useState<string[]>([]);
    const toggleCounterProduct = (productId: string) => {
      setCounterOfferedProductIds((prev) =>
        prev.includes(productId)
          ? prev.filter((existingId) => existingId !== productId)
          : [...prev, productId],
      );
    };

  const [counterMessage, setCounterMessage] = useState("");

  const activeOffer = item.offers[item.offers.length - 1];
  const isExchangeFinalized = item.product.status === "EXCHANGED";
  const tx = activeTransactionQuery.data;
  const isRequestCompleted =
    item.status === "COMPLETED" ||
    (item.status === "ACCEPTED" && (isExchangeFinalized || (!activeTransactionQuery.isPending && !tx)));
  const displayStatus: RequestSummary["status"] = isRequestCompleted ? "COMPLETED" : item.status;
  const showTransactionSection =
    item.status === "ACCEPTED" && !isRequestCompleted && (activeTransactionQuery.isPending || Boolean(tx));
  const canActByTurn = !showTransactionSection && OPEN_STATUSES.includes(item.status) && item.currentTurn === actorTurn;
  const canCancel = !showTransactionSection && OPEN_STATUSES.includes(item.status);
  const canCounter =
    !item.product.isFree &&
    (item.status === "PENDING" || item.status === "NEGOTIATING") &&
    canActByTurn;
  const isBuyer = sessionUserId === item.buyerId;
  const isSeller = sessionUserId === item.sellerId;
  const hasInlineInputOpen = showCounterForm;
  const selectableOwnProducts = ownOfferableProducts.filter(
    (product) => product.id !== item.productId,
  );

  const onAccept = () => {
    void acceptMutation.mutateAsync(item.id).catch(() => {
      setTxFeedback("Could not accept request");
    });
  };

  const onReject = () => {
    void rejectMutation.mutateAsync(item.id).catch(() => {
      setTxFeedback("Could not reject request");
    });
  };

  const onCancel = () => {
    void cancelMutation
      .mutateAsync({ requestId: item.id, reason: "Cancelled from app" })
      .catch((error) => {
        setTxFeedback(toRequestErrorMessage(error));
      });
  };

  const onSubmitCounter = () => {
    const payload: {
      offerType: "PRODUCT" | "MONEY" | "MIXED" | "NONE";
      offeredProducts?: string[];
      amount?: number;
      message?: string;
    } = {
      offerType: counterOfferType,
      ...(counterMessage.trim() ? { message: counterMessage.trim() } : {}),
    };

    if (counterOfferType === "MONEY" || counterOfferType === "MIXED") {
      const amountValue = Number(counterAmount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setTxFeedback("Enter a valid positive amount.");
        return;
      }
      payload.amount = amountValue;
    }

    if (counterOfferType === "PRODUCT" || counterOfferType === "MIXED") {
      if (counterOfferedProductIds.length === 0) {
        setTxFeedback("Select one or more listings for your counter offer.");
        return;
      }
      payload.offeredProducts = counterOfferedProductIds;
    }

    void counterOfferMutation
      .mutateAsync({ requestId: item.id, payload })
      .then(() => {
        setShowCounterForm(false);
        setCounterAmount("");
        setCounterMessage("");
        setCounterOfferedProductIds([]);
      })
      .catch((error) => {
        setTxFeedback(toRequestErrorMessage(error));
      });
  };

  return (
    <Pressable
      style={styles.itemCardPressable}
      disabled={hasInlineInputOpen}
      onPress={() => router.push(`/(app)/requests/${item.id}`)}
    >
      <View style={[styles.itemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}> 
        <View style={styles.detailsBlock}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, styles.statusLabel, { color: theme.colors.textMuted }]}>Status</Text>
            <View style={[styles.badgeWrap, { backgroundColor: getStatusBadgeStyle(displayStatus).bg }]}> 
              <Text style={[styles.badgeText, { color: getStatusBadgeStyle(displayStatus).text }]} numberOfLines={1}>
                {displayStatus}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Turn</Text>
            <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {item.currentTurn === actorTurn ? "Your turn" : "Their turn"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Latest Offer</Text>
            <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>{activeOffer?.type ?? "NONE"}</Text>
          </View>
          {activeOffer?.offeredAmount != null ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Amount</Text>
              <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                ₹{activeOffer.offeredAmount}
              </Text>
            </View>
          ) : null}
        </View>
        {item.message ? <Text style={[styles.messageText, { color: theme.colors.textSecondary }]}>{item.message}</Text> : null}

        {/*
        <View style={styles.actions}>
          <View style={styles.actionPillRow}>
            {canActByTurn ? (
              <Pressable
                onPress={onAccept}
                disabled={acceptMutation.isPending}
                style={[
                  styles.actionPill,
                  {
                    borderColor: "#86efac",
                    backgroundColor: "#f0fdf4",
                  },
                  acceptMutation.isPending ? styles.actionPillDisabled : null,
                ]}
              >
                {acceptMutation.isPending ? (
                  <Spinner size={12} />
                ) : (
                  <Feather name="check" size={14} color="#166534" />
                )}
                <Text style={[styles.actionPillText, { color: "#166534" }]}>Accept</Text>
              </Pressable>
            ) : null}

            {canActByTurn ? (
              <Pressable
                onPress={onReject}
                disabled={rejectMutation.isPending}
                style={[
                  styles.actionPill,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                  rejectMutation.isPending ? styles.actionPillDisabled : null,
                ]}
              >
                {rejectMutation.isPending ? (
                  <Spinner size={12} />
                ) : (
                  <Feather name="x" size={14} color={theme.colors.textSecondary} />
                )}
                <Text style={[styles.actionPillText, { color: theme.colors.textPrimary }]}>Decline</Text>
              </Pressable>
            ) : null}

            {canCounter ? (
              <Pressable
                onPress={() => setShowCounterForm((prev) => !prev)}
                style={[
                  styles.actionPill,
                  {
                    borderColor: showCounterForm ? theme.colors.primary : theme.colors.border,
                    backgroundColor: showCounterForm ? theme.colors.surfaceMuted : theme.colors.surfaceMuted,
                  },
                ]}
              >
                <Feather
                  name={showCounterForm ? "chevron-up" : "repeat"}
                  size={14}
                  color={showCounterForm ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.actionPillText,
                    { color: showCounterForm ? theme.colors.primary : theme.colors.textPrimary },
                  ]}
                >
                  {showCounterForm ? "Hide" : "Counter"}
                </Text>
              </Pressable>
            ) : null}

            {canCancel ? (
              <Pressable
                onPress={onCancel}
                disabled={cancelMutation.isPending}
                style={[
                  styles.actionPill,
                  {
                    borderColor: "#fecaca",
                    backgroundColor: "#fff7f7",
                  },
                  cancelMutation.isPending ? styles.actionPillDisabled : null,
                ]}
              >
                {cancelMutation.isPending ? (
                  <Spinner size={12} />
                ) : (
                  <Feather name="slash" size={14} color="#dc2626" />
                )}
                <Text style={[styles.actionPillText, { color: "#b91c1c" }]}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        */}

      {showCounterForm && canCounter ? (
        <View style={[styles.counterCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          <Text style={[styles.transactionTitle, { color: theme.colors.textPrimary }]}>Create Counter Offer</Text>

          {!item.product.isFree ? (
            <View style={styles.modeRow}>
              {item.product.requestByMoney ? (
                <>
                  <ToggleChip
                    label="MONEY"
                    selected={counterOfferType === "MONEY"}
                    style={styles.modeChip}
                    onPress={() => setCounterOfferType("MONEY")}
                  />
                  <ToggleChip
                    label="PRODUCT"
                    selected={counterOfferType === "PRODUCT"}
                    style={styles.modeChip}
                    onPress={() => setCounterOfferType("PRODUCT")}
                  />
                  <ToggleChip
                    label="MIXED"
                    selected={counterOfferType === "MIXED"}
                    style={styles.modeChip}
                    onPress={() => setCounterOfferType("MIXED")}
                  />
                </>
              ) : (
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>This request accepts product-only offers.</Text>
              )}
            </View>
          ) : null}

          {(counterOfferType === "MONEY" || counterOfferType === "MIXED") &&
          !item.product.isFree ? (
            <Input
              label="Amount"
              value={counterAmount}
              onChangeText={setCounterAmount}
              keyboardType="numeric"
            />
          ) : null}

          {(counterOfferType === "PRODUCT" || counterOfferType === "MIXED") &&
          !item.product.isFree ? (
            <View style={styles.offerWrap}>
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Select offered listing</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.offerList}
              >
                {selectableOwnProducts.map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => toggleCounterProduct(product.id)}
                    style={[
                      styles.offerChip,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                      counterOfferedProductIds.includes(product.id)
                        ? [styles.offerChipActive, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]
                        : undefined,
                    ]}
                  >
                    <Text
                      style={[
                        styles.offerChipText,
                        { color: theme.colors.textSecondary },
                        counterOfferedProductIds.includes(product.id)
                          ? [styles.offerChipTextActive, { color: theme.colors.onPrimary }]
                          : undefined,
                      ]}
                    >
                      {product.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {counterOfferedProductIds.length > 0 ? (
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                  {counterOfferedProductIds.length} listing(s) selected.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Input
            label="Message (optional)"
            value={counterMessage}
            onChangeText={setCounterMessage}
          />

          <Button
            label="Submit counter"
            loading={counterOfferMutation.isPending}
            onPress={onSubmitCounter}
          />
        </View>
      ) : null}

      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1, padding: 16, paddingBottom: 16, gap: 12 },
  fixedTopContent: { gap: 10 },
  scrollArea: { flex: 1, minHeight: 0 },
  scrollAreaContent: { flexGrow: 1, paddingBottom: 20 },
  headerCard: {
    marginBottom: 0,
  },
  tabsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10,
  },
  emptyCardGlobal: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  sectionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionScroll: { flex: 1 },
  sectionScrollContent: { paddingBottom: 24, gap: 8 },
  loadingWrap: { paddingVertical: 6 },
  errorCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    padding: 12,
    gap: 10,
  },
  errorText: { color: "#b91c1c", fontSize: 13 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
  listWrap: { gap: 8 },
  listWrapFlatlist: { flex: 1, minHeight: 0 },
  groupList: {
    gap: 8,
  },
  groupScrollContent: {
    gap: 8,
  },
  productGroupHeader: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  productGroupHeaderWithTopBorder: {
    // Gap is handled by FlatList contentContainerStyle
  },
  productGroupTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  productGroupCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  itemCardPressable: {
    opacity: 1,
  },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
  detailsBlock: {
    gap: 7,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    width: 90,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  metaPill: { fontSize: 12, fontWeight: "500" },
  metaDot: { fontSize: 11 },
  metaText: { fontSize: 12 },
  contactCardRow: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 3,
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageText: { marginTop: 2, fontSize: 13, fontStyle: "italic" },
  actions: { marginTop: 8, gap: 8 },
  actionPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionPill: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 32,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionPillDisabled: {
    opacity: 0.6,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 8,
  },
  actionCell: {
    flex: 1,
    minWidth: 0,
  },
  actionRowSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionRowTertiary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionSecondaryCell: {
    flex: 1,
    minWidth: 0,
  },
  counterCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: { flex: 1, minWidth: 0 },
  offerWrap: { gap: 6 },
  offerList: { gap: 8, paddingRight: 8 },
  offerChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  offerChipActive: {},
  offerChipText: { fontSize: 12, fontWeight: "600" },
  offerChipTextActive: {},
  transactionCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  transactionTitle: { fontSize: 13, fontWeight: "700" },
  otpText: { fontSize: 15, fontWeight: "700" },
  filterModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  filterModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 10,
  },
  filterModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  filterOption: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  filterOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  filterActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  filterActionBtn: {
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
});
