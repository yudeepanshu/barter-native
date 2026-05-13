import {
  Dimensions,
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
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RequestStatus, RequestSummary, RequestTurn } from "@barter/types";
import { StatusBar } from "expo-status-bar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";
import { ListControlsRow } from "@/components/filters/ListControlsRow";
import { FilterChip } from "@/components/filters/FilterChip";
import {
  REQUESTS_SENT_MATCH_LIMIT,
  REQUESTS_SHARED_LIMIT,
  useRequestsQuery,
} from "@/hooks/queries/useRequestsQuery";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";
import { EmptyView } from "@/components/ui/EmptyView";
import { formatTimeAgo, getOfferTypeLabel } from "@/lib/utils/commonUtils";
import { formatCurrency } from "@/lib/currency";

const SCREEN_HEIGHT = Dimensions.get("window").height;
// Fixed chrome inside the modal: header row + action buttons row + section titles + paddings + gaps
const MODAL_CHROME_HEIGHT = 200;
const FILTER_SCROLL_MAX_HEIGHT = SCREEN_HEIGHT * 0.65 - MODAL_CHROME_HEIGHT;

const OPEN_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING"];
const ALL_PRODUCTS_FILTER = "__ALL_PRODUCTS__";

const ALL_REQUEST_STATUSES: RequestStatus[] = [
  "PENDING",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
];

type TurnFilter = "MY_TURN" | "THEIR_TURN" | null;

type ProductRequestGroup = {
  productId: string;
  productTitle: string;
  requests: RequestSummary[];
  latestUpdatedAtMs: number;
};

type TabFilterState = {
  productId: string;
  statuses: RequestStatus[];
  turn: TurnFilter;
};

const DEFAULT_TAB_FILTER: TabFilterState = {
  productId: ALL_PRODUCTS_FILTER,
  statuses: [],
  turn: null,
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
    case "CANCELLED": return { bg: "#f1f5f9", text: "#111827" };
    case "COMPLETED": return { bg: "#ccfbf1", text: "#0f766e" };
    default: return { bg: "#e2e8f0", text: "#334155" };
  }
}

function getStatusLabel(status: RequestStatus): string {
  switch (status) {
    case "PENDING": return "Pending";
    case "NEGOTIATING": return "Negotiating";
    case "ACCEPTED": return "Accepted";
    case "REJECTED": return "Rejected";
    case "CANCELLED": return "Cancelled";
    case "COMPLETED": return "Completed";
    default: return status;
  }
}

/**
 * Applies status and turn filters to requests within each product group,
 * then drops groups that become empty after filtering.
 */
function applyRequestFilters(
  groups: ProductRequestGroup[],
  statuses: RequestStatus[],
  turn: TurnFilter,
  actorTurn: RequestTurn,
): ProductRequestGroup[] {
  return groups
    .map((group) => {
      const filtered = group.requests.filter((req) => {
        // Status filter: if any statuses selected, request must match one.
        // Treat COMPLETED as matching both "COMPLETED" status and ACCEPTED+EXCHANGED.
        if (statuses.length > 0) {
          const isExchangeFinalized = req.product.status === "EXCHANGED";
          const effectiveStatus: RequestStatus =
            req.status === "ACCEPTED" && isExchangeFinalized ? "COMPLETED" : req.status;
          if (!statuses.includes(effectiveStatus)) return false;
        }

        // Turn filter: only applies to open requests.
        if (turn !== null) {
          const isOpen = OPEN_STATUSES.includes(req.status);
          if (!isOpen) return false;
          const isMyTurn = req.currentTurn === actorTurn;
          if (turn === "MY_TURN" && !isMyTurn) return false;
          if (turn === "THEIR_TURN" && isMyTurn) return false;
        }

        return true;
      });

      return { ...group, requests: filtered };
    })
    .filter((group) => group.requests.length > 0);
}

export default function RequestsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; productId?: string, _t?: string }>();
  const { theme, statusBarStyle } = useAppTheme();
  const session = useSession();
  const sentQuery = useRequestsQuery("sent", { limit: REQUESTS_SENT_MATCH_LIMIT });
  const receivedQuery = useRequestsQuery("received", { limit: REQUESTS_SHARED_LIMIT });

  const sentItems = sentQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedItems = receivedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedGroups = useMemo(() => buildProductRequestGroups(receivedItems), [receivedItems]);
  const sentGroups = useMemo(() => buildProductRequestGroups(sentItems), [sentItems]);

  const [activeTab, setActiveTab] = useState<"received" | "sent">(
    params.tab === "sent" ? "sent" : "received",
  );

  // ── Per-tab applied filter state ────────────────────────────────────────────
  const [filterByTab, setFilterByTab] = useState<{ received: TabFilterState; sent: TabFilterState }>({
    received: { ...DEFAULT_TAB_FILTER },
    sent: { ...DEFAULT_TAB_FILTER },
  });

  // ── Draft state (used inside the open modal before Apply is pressed) ────────
  const [showProductFilterModal, setShowProductFilterModal] = useState(false);
  const [draftFilter, setDraftFilter] = useState<TabFilterState>({ ...DEFAULT_TAB_FILTER });

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
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
  const currentFilter = filterByTab[activeTab];
  const actorTurn: RequestTurn = activeTab === "received" ? "SELLER" : "BUYER";

  // ── Filtered groups: listing → status → turn ────────────────────────────────
  const filteredGroups = useMemo(() => {
    // Step 1: listing filter
    let groups = currentFilter.productId === ALL_PRODUCTS_FILTER
      ? currentGroups
      : currentGroups.filter((g) => g.productId === currentFilter.productId);

    // Step 2: status + turn filters
    groups = applyRequestFilters(groups, currentFilter.statuses, currentFilter.turn, actorTurn);

    return groups;
  }, [currentGroups, currentFilter, actorTurn]);

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
    productFilterOptions.find((option) => option.value === currentFilter.productId)?.label ?? "All products";

  const activeFilterCount =
    (currentFilter.productId === ALL_PRODUCTS_FILTER ? 0 : 1) +
    currentFilter.statuses.length +
    (currentFilter.turn !== null ? 1 : 0);

  // Turn filter is only shown when Pending or Negotiating is explicitly selected in the draft.
  const draftHasOpenStatus = draftFilter.statuses.some((s) => OPEN_STATUSES.includes(s));

  // ── Deep-link param handling ─────────────────────────────────────────────────
  useEffect(() => {
    const requestedProductId = typeof params.productId === "string" ? params.productId : null;
    if (!requestedProductId) return;

    const tab = params.tab === "sent" ? "sent" : "received";
    const paramKey = `${tab}:${requestedProductId}:${params._t ?? ""}`;
    if (lastAppliedParamKeyRef.current === paramKey) return;

    const hasRequestedProduct = (tab === "sent" ? sentGroups : receivedGroups).some(
      (group) => group.productId === requestedProductId,
    );
    if (!hasRequestedProduct) return;

    setActiveTab(tab);
    setFilterByTab((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], productId: requestedProductId },
    }));
    lastAppliedParamKeyRef.current = paramKey;
  }, [params.productId, params.tab, receivedGroups, sentGroups]);

  const onOpenProductFilter = () => {
    setDraftFilter({ ...currentFilter });
    setShowProductFilterModal(true);
  };

  const onApplyProductFilter = () => {
    setFilterByTab((prev) => ({
      ...prev,
      [activeTab]: { ...draftFilter },
    }));
    setShowProductFilterModal(false);
  };

  const onClearAllFilters = () => {
    setDraftFilter({ ...DEFAULT_TAB_FILTER });
  };

  // ── Draft helpers ────────────────────────────────────────────────────────────
  const toggleDraftStatus = (status: RequestStatus) => {
    setDraftFilter((prev) => {
      const exists = prev.statuses.includes(status);
      const nextStatuses = exists
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];

      // If no open statuses remain explicitly selected, clear the turn filter.
      const nextHasOpenStatus = nextStatuses.some((s) => OPEN_STATUSES.includes(s));

      return {
        ...prev,
        statuses: nextStatuses,
        turn: nextHasOpenStatus ? prev.turn : null,
      };
    });
  };

  const setDraftTurn = (turn: TurnFilter) => {
    setDraftFilter((prev) => ({
      ...prev,
      turn: prev.turn === turn ? null : turn,
    }));
  };

  const onRefreshAll = () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    void Promise.allSettled([
      sentQuery.refetch(),
      receivedQuery.refetch(),
    ]).finally(() => setIsManualRefreshing(false));
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
                <RefreshControl refreshing={isManualRefreshing} onRefresh={onRefreshAll} />
              }
              keyboardDismissMode="on-drag"
            >
              <EmptyView
                title="Nothing here yet"
                message="Your sent and received requests will show up here once activity begins."
              />
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
              activeFilterCount={activeFilterCount}
              onOpenFilter={onOpenProductFilter}
              sessionUserId={session?.user.id ?? ""}
              isRefreshing={isManualRefreshing}
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
              activeFilterCount={activeFilterCount}
              onOpenFilter={onOpenProductFilter}
              sessionUserId={session?.user.id ?? ""}
              isRefreshing={isManualRefreshing}
              onRefresh={onRefreshAll}
            />
          ) : null}
        </View>

        {/* ── Filter Modal ──────────────────────────────────────────────────── */}
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
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
              onPress={() => {/* Keep modal open when tapping inside */}}
            >
              {/* Header */}
              <View style={styles.filterModalHeaderRow}>
                <Text style={[styles.filterModalTitle, { color: theme.colors.textPrimary }]}>Filters</Text>
                <Pressable onPress={() => setShowProductFilterModal(false)}>
                  <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              </View>

              {/*
                Scrollable filter sections — capped at FILTER_SCROLL_MAX_HEIGHT.
                When content is short, ScrollView shrinks naturally.
                When content overflows, scroll kicks in without growing past 65% screen.
              */}
              <View style={[styles.filterScrollWrapper, { maxHeight: FILTER_SCROLL_MAX_HEIGHT }]}>
                <ScrollView
                  contentContainerStyle={styles.filterScrollContentContainer}
                  showsVerticalScrollIndicator={true}
                >
                  {/* ── Section 1: Filter by listing ── */}
                  <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary }]}>
                    Listing
                  </Text>
                  <View style={styles.filterChipsContainer}>
                    {productFilterOptions.map((option) => (
                      <FilterChip
                        key={option.value}
                        active={draftFilter.productId === option.value}
                        label={`${option.label} (${option.count})`}
                        onPress={() => setDraftFilter((prev) => ({ ...prev, productId: option.value }))}
                      />
                    ))}
                  </View>

                  {/* ── Section 2: Filter by status ── */}
                  <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                    Status
                  </Text>
                  <View style={styles.filterChipsContainer}>
                    {ALL_REQUEST_STATUSES.map((status) => (
                      <FilterChip
                        key={status}
                        active={draftFilter.statuses.includes(status)}
                        label={getStatusLabel(status)}
                        onPress={() => toggleDraftStatus(status)}
                      />
                    ))}
                  </View>

                  {/* ── Section 3: Filter by turn — only shown when Pending/Negotiating could be in results ── */}
                  {draftHasOpenStatus ? (
                    <>
                      <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                        Turn
                      </Text>
                      <View style={styles.filterChipsContainer}>
                        <FilterChip
                          active={draftFilter.turn === "MY_TURN"}
                          label="My turn"
                          onPress={() => setDraftTurn("MY_TURN")}
                        />
                        <FilterChip
                          active={draftFilter.turn === "THEIR_TURN"}
                          label="Their turn"
                          onPress={() => setDraftTurn("THEIR_TURN")}
                        />
                      </View>
                    </>
                  ) : null}
                </ScrollView>
              </View>

              {/* Action buttons */}
              <View style={styles.filterActionRow}>
                <Pressable
                  style={[
                    styles.filterActionBtn,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                  onPress={onClearAllFilters}
                >
                  <Text style={[styles.filterActionText, { color: theme.colors.textSecondary }]}>Clear all</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.filterActionBtn,
                    { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
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

// ── RequestSection ─────────────────────────────────────────────────────────────

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
  sessionUserId,
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
  sessionUserId: string;
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
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            No {title.toLowerCase()} requests match the selected filters.
          </Text>
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
                  sessionUserId={sessionUserId}
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

// ── RequestItem ────────────────────────────────────────────────────────────────

// function getStatusBorderColor(
//   status: RequestSummary["status"],
//   isCompleted: boolean,
//   colors: ReturnType<typeof useAppTheme>["theme"]["colors"]
// ): string {
//   if (isCompleted) return "#16a34a"; // green
//   switch (status) {
//     case "PENDING":
//     case "ACCEPTED":
//       return colors.primary;       // brand blue – active/open
//     case "CANCELLED":
//       return colors.border;        // neutral grey
//     default:
//       return colors.border;
//   }
// }

const RequestItem = memo(function RequestItem({
  item,
  router,
  actorTurn,
  sessionUserId,
}: {
  item: RequestSummary;
  router: ReturnType<typeof useRouter>;
  actorTurn: RequestTurn;
  sessionUserId: string;
}) {
  const { theme } = useAppTheme();

  const activeOffer = item.offers[item.offers.length - 1];
  const isExchangeFinalized = item.product.status === "EXCHANGED";
  const isRequestCompleted =
    item.status === "COMPLETED" ||
    (item.status === "ACCEPTED" && isExchangeFinalized);
  const displayStatus: RequestSummary["status"] = isRequestCompleted
    ? "COMPLETED"
    : item.status;
  const showTurn =
    OPEN_STATUSES.includes(item.status) && Boolean(item.currentTurn);
  const isMyTurn = item.currentTurn === actorTurn;
  const isBuyer = sessionUserId === item.buyerId;
  const requestedByLabel = isBuyer
    ? "You"
    : item.buyer.userName?.trim() || "Unknown";
  const initials = requestedByLabel
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // Offer display
  const hasOffer =
    activeOffer?.type && activeOffer.type !== "NONE";
  const isTrade = activeOffer?.type === "PRODUCT" || activeOffer?.type === "MIXED";
  const offerLabel = hasOffer ? getOfferTypeLabel(activeOffer.type) : "N/A";
  const offerAmount =
    hasOffer && activeOffer.offeredAmount != null
      ? formatCurrency(activeOffer.offeredAmount)
      : null;

  return (
    <Pressable
      style={styles.itemCardPressable}
      onPress={() => router.push(`/(app)/requests/${item.id}`)}
    >
      <View
        style={[
          styles.itemCard,
              {
                borderColor: theme.mode === "dark"
                  ? "rgba(255,255,255,0.12)"   // soft luminous white glow in dark
                  : "rgba(0,0,0,0.10)",        // subtle shadow-like border in light
                backgroundColor: theme.colors.surfaceMuted,
              },
        ]}
      >
      {/* ── Top row: avatar · name/time · badge+turn column ── */}
      <View style={styles.itemTopRow}>
        <View style={[styles.itemAvatar, { backgroundColor: theme.colors.surface ?? "#e0e7ff" }]}>
          <Text style={[styles.itemAvatarText, { color: theme.colors.primary }]}>{initials}</Text>
        </View>

        <View style={styles.itemNameTimeCol}>
          <Text
            style={[styles.itemUserName, { color: theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {requestedByLabel}
          </Text>
          <Text
            style={[styles.itemTimeText, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {formatTimeAgo(item.updatedAt ? item.updatedAt : item.createdAt)}
          </Text>
        </View>

        {/* Badge + turn stacked in a column on the right */}
        <View style={styles.itemBadgeTurnCol}>
          <View style={[
            styles.badgeWrap,
            {
              backgroundColor: getStatusBadgeStyle(displayStatus).bg,
              borderWidth: displayStatus === "CANCELLED" ? 1 : 0,
              borderColor: displayStatus === "CANCELLED" ? theme.colors.border : "transparent",
            },
          ]}>
            <Text
              style={[styles.badgeText, { color: getStatusBadgeStyle(displayStatus).text }]}
              numberOfLines={1}
            >
              {getStatusLabel(displayStatus)}
            </Text>
          </View>

          {showTurn && (
            <Text style={[
              styles.itemTurnText,
              { color: isMyTurn ? "#16a34a" : theme.colors.textSecondary },
            ]}>
              {isMyTurn ? "Your turn" : "Their turn"}
            </Text>
          )}
        </View>
      </View>

      {/* ── Bottom block: offer row only ── */}
      {hasOffer && (
        <View style={[styles.itemBottomBlock, { borderTopColor: theme.colors.border }]}>
          <View style={styles.itemOfferInline}>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
              Latest offer:
            </Text>
            <View style={styles.itemOfferValue}>
              {isTrade && (
                <Feather
                  name="repeat"
                  size={12}
                  color={theme.colors.textPrimary}
                  style={{ marginRight: 3 }}
                />
              )}
              {isTrade && (
                <Text
                  style={[styles.detailValue, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {offerLabel === 'CASH + TRADE' ? 'TRADE' : offerLabel}
                </Text>
              )}
              {isTrade && offerAmount != null && (
                <Feather name="plus" size={11} color={theme.colors.textMuted} />
              )}
              {offerAmount != null && (
                <Text
                  style={[styles.detailValue, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {offerAmount}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
          </View>
        </View>
      )}
      </View>
    </Pressable>
  );
});

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  // itemCard: {
  //   borderWidth: 1,
  //   borderRadius: 12,
  //   padding: 12,
  //   gap: 8,
  // },
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
  // detailLabel: {
  //   fontSize: 12,
  //   fontWeight: "600",
  //   width: 90,
  // },
  statusLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  // detailValue: {
  //   flex: 1,
  //   fontSize: 12,
  //   fontWeight: "700",
  //   textAlign: "right",
  // },
  // badgeWrap: {
  //   paddingHorizontal: 8,
  //   paddingVertical: 3,
  //   borderRadius: 8,
  //   overflow: "hidden",
  //   flexShrink: 0,
  // },
  // badgeText: { fontSize: 11, fontWeight: "700" },
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
    flexDirection: "column",
  },
  filterScrollWrapper: {
    width: "100%",
  },
  filterScrollContentContainer: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  filterSectionHint: {
    fontSize: 11,
    marginBottom: 8,
    paddingHorizontal: 4,
    marginTop: -4,
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
  filterChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },


  // itemTopRow: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   gap: 8,
  // },
  itemAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemAvatarText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // itemUserName: {
  //   flex: 1,
  //   fontSize: 13,
  //   fontWeight: "600",
  // },
  // itemBottomBlock: {
  //   borderTopWidth: 0.5,
  //   paddingTop: 8,
  //   gap: 8,
  // },
  // itemTurnRow: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "space-between",
  // },
  // itemOfferInline: {
  //   flex: 1,
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "space-between",
  //   gap: 6,
  //   minWidth: 0,
  // },
  // itemOfferValue: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   gap: 5,
  //   flexShrink: 1,
  //   minWidth: 0,
  // },
  // itemOfferDot: {
  //   width: 3,
  //   height: 3,
  //   borderRadius: 2,
  //   flexShrink: 0,
  // },
  itemTurnPill: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
    flexGrow: 0,
  },
  // itemTurnText: {
  //   fontSize: 11,
  //   fontWeight: "600",
  // },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 0,
  },
  detailValue: {
    flexShrink: 1,
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
  itemCard: {
    borderWidth: 1.5,          // slightly thicker so the colour reads clearly
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemNameTimeCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  itemUserName: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemTimeText: {
    fontSize: 11,
    fontWeight: "400",
  },
  itemBottomBlock: {
    borderTopWidth: 0.5,
    paddingTop: 8,
    gap: 6,
  },
  itemOfferInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  itemOfferValue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  itemOfferDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    flexShrink: 0,
  },
  itemTurnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemBadgeTurnCol: {
  alignItems: "flex-end",
  gap: 4,
  flexShrink: 0,
},
  itemTurnText: {
    fontSize: 11,
    fontWeight: "600",
    alignSelf: "center",
  },
});
