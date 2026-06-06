import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RequestStatus, RequestSummary, RequestTurn } from "@barter/types";
import { StatusBar } from "expo-status-bar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";
import { ListControlsRow } from "@/components/filters/ListControlsRow";
import { FilterChip } from "@/components/filters/FilterChip";
import { AppImage } from "@/components/ui/AppImage";
import {
  REQUESTS_SENT_MATCH_LIMIT,
  REQUESTS_SHARED_LIMIT,
  useRequestsQuery,
} from "@/hooks/queries/useRequestsQuery";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";
import { EmptyView } from "@/components/ui/EmptyView";
import { RequestItem } from "./RequestItem";
import { ErrorView } from "@/components/ui/ErrorView";
import { ScreenSafeView } from "@/components/layout/ScreenSafeView";
import { CustomScrollView } from "@/components/ui/CustomScrollView";
import { CustomFlatList } from "@/components/ui/CustomFlatList";

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

type OfferTypeFilter = "PRODUCT" | "MONEY" | "MIXED" | "NONE" | null;
type TurnFilter = "MY_TURN" | "THEIR_TURN" | null;

type ProductRequestGroup = {
  productId: string;
  productTitle: string;
  requests: RequestSummary[];
  latestUpdatedAtMs: number;
};

type TabFilterState = {
  productId: string;
  // Sent-tab only: filter by the buyer's own offered/attached product
  myProductId: string;
  statuses: RequestStatus[];
  turn: TurnFilter;
  offerType: OfferTypeFilter;
};

const DEFAULT_TAB_FILTER: TabFilterState = {
  productId: ALL_PRODUCTS_FILTER,
  myProductId: ALL_PRODUCTS_FILTER,
  statuses: [],
  turn: null,
  offerType: null,
};

// ── Offer-type helpers ─────────────────────────────────────────────────────────

type OfferTypeLiteral = "PRODUCT" | "MONEY" | "MIXED" | "NONE";

const OFFER_TYPE_OPTIONS: { value: OfferTypeLiteral; label: string }[] = [
  { value: "PRODUCT", label: "Trade" },
  { value: "MONEY",   label: "Money" },
  { value: "MIXED",   label: "Both" },
  { value: "NONE",    label: "None" },
];

// ── Grouping helpers ───────────────────────────────────────────────────────────

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

// TODO: Uncomment when enabling "Your Offered Products" filter on Sent tab
// /**
//  * Build a productId -> title lookup by scanning visibleProducts and all offer
//  * products across every request. Casts the widest net so titles are always found.
//  */
// function buildProductTitleCache(items: RequestSummary[]): Map<string, string> {
//   const cache = new Map<string, string>();
//   for (const req of items) {
//     for (const vp of req.visibleProducts) {
//       if (!cache.has(vp.productId)) cache.set(vp.productId, vp.product.title);
//     }
//     for (const offer of req.offers) {
//       for (const op of offer.offeredProducts) {
//         if (!cache.has(op.productId) && op.product?.title) {
//           cache.set(op.productId, op.product.title);
//         }
//       }
//     }
//   }
//   return cache;
// }

// TODO: Uncomment when enabling "Your Offered Products" filter on Sent tab
// /**
//  * For the Sent tab: collect unique products from the active offer (accepted if
//  * one exists, otherwise the latest by createdAt) of each request.
//  */
// function buildMyOfferedProductOptions(items: RequestSummary[]) {
//   const titleCache = buildProductTitleCache(items);
//   const map = new Map<string, { productId: string; productTitle: string; count: number }>();
//   for (const req of items) {
//     if (req.offers.length === 0) continue;
//     const activeOffer =
//       req.offers.find((o) => o.id === req.acceptedOfferId) ??
//       req.offers.reduce((latest, o) =>
//         new Date(o.createdAt) > new Date(latest.createdAt) ? o : latest,
//       );
//     for (const op of activeOffer.offeredProducts) {
//       const existing = map.get(op.productId);
//       if (existing) {
//         existing.count += 1;
//       } else {
//         const productTitle = titleCache.get(op.productId) ?? op.productId;
//         map.set(op.productId, { productId: op.productId, productTitle, count: 1 });
//       }
//     }
//   }
//   return Array.from(map.values()).sort((a, b) => b.count - a.count);
// }

function getStatusLabel(status: RequestStatus): string {
  switch (status) {
    case "PENDING":     return "Pending";
    case "NEGOTIATING": return "Negotiating";
    case "ACCEPTED":    return "Accepted";
    case "REJECTED":    return "Rejected";
    case "CANCELLED":   return "Cancelled";
    case "COMPLETED":   return "Completed";
    default:            return status;
  }
}

/**
 * Applies all filters (product, myProduct, status, turn, offerType) to
 * requests within each group, then drops groups that become empty.
 */
function applyRequestFilters(
  groups: ProductRequestGroup[],
  filter: TabFilterState,
  actorTurn: RequestTurn,
): ProductRequestGroup[] {
  const { statuses, turn, offerType } = filter; // myProductId omitted until "Your Offered Products" filter is re-enabled

  return groups
    .map((group) => {
      const filtered = group.requests.filter((req) => {
        // ── Resolve the "active" offer: accepted first, otherwise latest by createdAt ──
        const activeOffer = req.offers.length === 0
          ? null
          : req.offers.find((o) => o.id === req.acceptedOfferId) ??
            req.offers.reduce((latest, o) =>
              new Date(o.createdAt) > new Date(latest.createdAt) ? o : latest,
            );

        // ── Offer-type filter ──────────────────────────────────────────────────
        if (offerType !== null) {
          if (!activeOffer || activeOffer.type !== offerType) return false;
        }

        // TODO: Uncomment when enabling "Your Offered Products" filter on Sent tab
        // if (myProductId !== ALL_PRODUCTS_FILTER) {
        //   const hasProduct = activeOffer?.offeredProducts.some(
        //     (op) => op.productId === myProductId,
        //   ) ?? false;
        //   if (!hasProduct) return false;
        // }

        // ── Status filter ──────────────────────────────────────────────────────
        if (statuses.length > 0) {
          const isExchangeFinalized = req.product.status === "EXCHANGED";
          const effectiveStatus: RequestStatus =
            req.status === "ACCEPTED" && isExchangeFinalized ? "COMPLETED" : req.status;
          if (!statuses.includes(effectiveStatus)) return false;
        }

        // ── Turn filter (open requests only) ───────────────────────────────────
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

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function RequestsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; productId?: string; _t?: string }>();
  const { theme, statusBarStyle } = useAppTheme();
  const session = useSession();
  const sentQuery = useRequestsQuery("sent", { limit: REQUESTS_SENT_MATCH_LIMIT });
  const receivedQuery = useRequestsQuery("received", { limit: REQUESTS_SHARED_LIMIT });

  const sentItems = sentQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedItems = receivedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedGroups = useMemo(() => buildProductRequestGroups(receivedItems), [receivedItems]);
  const sentGroups = useMemo(() => buildProductRequestGroups(sentItems), [sentItems]);

  // TODO: Uncomment when enabling "Your Offered Products" filter on Sent tab
  // const myOfferedProductOptions = useMemo(
  //   () => buildMyOfferedProductOptions(sentItems),
  //   [sentItems],
  // );

  const [activeTab, setActiveTab] = useState<"received" | "sent">(
    params.tab === "sent" ? "sent" : "received",
  );

  // ── Per-tab applied filter state ─────────────────────────────────────────────
  const [filterByTab, setFilterByTab] = useState<{ received: TabFilterState; sent: TabFilterState }>({
    received: { ...DEFAULT_TAB_FILTER },
    sent: { ...DEFAULT_TAB_FILTER },
  });

  // ── Draft state (used inside the open modal before Apply is pressed) ─────────
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
  }, [activeTab, receivedQuery.isPending, sentQuery.isPending, stableTabOptions]);

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

  // ── Filtered groups ───────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    let groups = currentFilter.productId === ALL_PRODUCTS_FILTER
      ? currentGroups
      : currentGroups.filter((g) => g.productId === currentFilter.productId);

    groups = applyRequestFilters(groups, currentFilter, actorTurn);

    return groups;
  }, [currentGroups, currentFilter, actorTurn]);

  // ── Filter modal options ──────────────────────────────────────────────────────
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
    // TODO: Uncomment when enabling "Your Offered Products" filter: (currentFilter.myProductId === ALL_PRODUCTS_FILTER ? 0 : 1) +
    currentFilter.statuses.length +
    (currentFilter.turn !== null ? 1 : 0) +
    (currentFilter.offerType !== null ? 1 : 0);

  // Turn filter is only shown when Pending or Negotiating is explicitly selected in the draft.
  const draftHasOpenStatus = draftFilter.statuses.some((s) => OPEN_STATUSES.includes(s));

  // ── Deep-link param handling ──────────────────────────────────────────────────
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

  // ── Modal handlers ────────────────────────────────────────────────────────────
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

  // ── Draft helpers ─────────────────────────────────────────────────────────────
  const toggleDraftStatus = (status: RequestStatus) => {
    setDraftFilter((prev) => {
      const exists = prev.statuses.includes(status);
      const nextStatuses = exists
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];

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

  const setDraftOfferType = (type: OfferTypeLiteral) => {
    setDraftFilter((prev) => ({
      ...prev,
      offerType: prev.offerType === type ? null : type,
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
    <ScreenSafeView>
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
            <View style={[styles.emptyCardGlobal, /* { backgroundColor: theme.colors.surface, borderColor: theme.colors.border } */]}>
              <Spinner size={20} />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>Loading requests...</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>Fetching latest received and sent requests.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.scrollArea}>
          {!isInitialLoading && isEverythingEmpty ? (
            <CustomScrollView
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
            </CustomScrollView>
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

        {/* ── Filter Modal ───────────────────────────────────────────────────── */}
        <Modal
          visible={showProductFilterModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProductFilterModal(false)}
        >
          <View
            style={[styles.filterModalBackdrop, { backgroundColor: theme.colors.overlay }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowProductFilterModal(false)} />
            <View
              style={[
                styles.filterModalSheet,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              {/* Header */}
              <View style={styles.filterModalHeaderRow}>
                <Text style={[styles.filterModalTitle, { color: theme.colors.textPrimary }]}>Filters</Text>
                <Pressable onPress={() => setShowProductFilterModal(false)}>
                  <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              </View>

              <View style={[styles.filterScrollWrapper, { maxHeight: FILTER_SCROLL_MAX_HEIGHT }]}>
                <CustomScrollView
                  contentContainerStyle={styles.filterScrollContentContainer}
                  showsVerticalScrollIndicator={true}
                >

                  {/* ── Section 1: Filter by listing (seller's product) ── */}
                  <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary }]}>
                    {activeTab === "received" ? "Your Listings" : "Requested Listings"}
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


                  {/* ── Section 2: Offer type ── */}
                  <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                    Offer Type
                  </Text>
                  <View style={styles.filterChipsContainer}>
                    {OFFER_TYPE_OPTIONS.map((option) => (
                      <FilterChip
                        key={option.value}
                        active={draftFilter.offerType === option.value}
                        label={option.label}
                        onPress={() => setDraftOfferType(option.value)}
                      />
                    ))}
                  </View>

                  {/* TODO: Uncomment when enabling "Your Offered Products" filter on Sent tab */}
                  {/* {activeTab === "sent" && myOfferedProductOptions.length > 0 ? (
                    <>
                      <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                        Your Offered Products
                      </Text>
                      <View style={styles.filterChipsContainer}>
                        <FilterChip
                          active={draftFilter.myProductId === ALL_PRODUCTS_FILTER}
                          label="All"
                          onPress={() =>
                            setDraftFilter((prev) => ({ ...prev, myProductId: ALL_PRODUCTS_FILTER }))
                          }
                        />
                        {myOfferedProductOptions.map((option) => (
                          <FilterChip
                            key={option.productId}
                            active={draftFilter.myProductId === option.productId}
                            label={`${option.productTitle} (${option.count})`}
                            onPress={() =>
                              setDraftFilter((prev) => ({ ...prev, myProductId: option.productId }))
                            }
                          />
                        ))}
                      </View>
                    </>
                  ) : null} */}

                  {/* ── Section 4: Filter by status ── */}
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

                  {/* ── Section 5: Filter by turn — only when Pending/Negotiating could be in results ── */}
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
                </CustomScrollView>
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
            </View>
          </View>
        </Modal>
      </View>
    </ScreenSafeView>
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
        <ErrorView
          title={`Could not load ${title.toLowerCase()} requests`}
          message="Something went wrong. Please try again."
          buttons={[
            {
              label: "Retry",
              onPress: onRetry,
            },
          ]}
        />
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
          <CustomFlatList<typeof flattenedRows[0]>
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
              row.kind === "header" ? (() => {
                const primaryImage =
                  row.group.requests[0]?.product.productImages?.find((img) => img.isPrimary) ||
                  row.group.requests[0]?.product.productImages?.[0];
                return (
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
                    {primaryImage?.url && (
                      <AppImage
                        uri={primaryImage.url}
                        style={styles.productGroupThumb}
                        recyclingKey={primaryImage.url}
                      />
                    )}
                    <Text
                      style={[styles.productGroupTitle, { color: theme.colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {row.group.productTitle}
                    </Text>
                    <Text style={[styles.productGroupCount, { color: theme.colors.textMuted }]}>
                      {row.group.requests.length} request(s)
                    </Text>
                  </View>
                );
              })() : (
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
    // borderWidth: 1,
    // borderRadius: 16,
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
  listWrapFlatlist: { flex: 1, minHeight: 0 },
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
  productGroupHeaderWithTopBorder: {},
  productGroupTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  productGroupCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  productGroupThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    flexShrink: 0,
  },
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
  filterModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "800",
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
});