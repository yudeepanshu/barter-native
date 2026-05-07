import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ProductSummary, RequestSummary } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useRequestDetailQuery } from "@/hooks/queries/useRequestDetailQuery";
import { useActiveTransactionQuery } from "@/hooks/queries/useActiveTransactionQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useCancelAllRequestsForProductMutation,
  useCreateCounterOfferMutation,
  useRejectRequestMutation,
  useRequestContactRevealMutation,
  useRespondContactRevealMutation,
  toErrorMessage as toRequestErrorMessage,
} from "@/hooks/mutations/useRequestMutations";
import {
  useGenerateTransactionOtpMutation,
  useVerifyTransactionOtpMutation,
  toErrorMessage as toTransactionErrorMessage,
} from "@/hooks/mutations/useTransactionMutations";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { SwipeableBottomSheet } from "@/components/ui/SwipeableBottomSheet";
import { ProductCard } from "@/components/products/ProductCard";
import { OtpCodeField } from "@/components/auth/OtpCodeField";
import { Input } from "@/components/ui/Input";
import { MenuHeader } from "@/components/ui/MenuHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CounterOfferForm } from "@/components/requests/CounterOfferForm";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { AppImage } from "@/components/ui/AppImage";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { FloatingModal } from "@/components/ui/FloatingModal";
import { useRequestRoom, useTransactionRoom } from "@/lib/realtime/rooms";
import { useRealtimeToastScope } from "@/lib/realtime/useRealtimeToastScope";
import {
  useUpdateProfileMutation,
  toErrorMessage as toProfileErrorMessage,
} from "@/hooks/mutations/useUpdateProfileMutation";
import { getFirstName, getOfferTypeLabel } from "@/lib/utils/commonUtils";
import { ErrorView } from "@/components/ui/ErrorView";
import { queryKeys } from "@/lib/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

const OPEN_STATUSES: RequestSummary["status"][] = ["PENDING", "NEGOTIATING"];

function getOfferStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "ACTIVE": return { bg: "#1e40af", text: "#ffffff" };
    case "PENDING": return { bg: "#fef3c7", text: "#b45309" };
    case "ACCEPTED": return { bg: "#d1fae5", text: "#065f46" };
    case "REJECTED": return { bg: "#fee2e2", text: "#dc2626" };
    case "CANCELLED":
    case "SUPERSEDED":
      return { bg: "#e2e8f0", text: "#475569" };
    default: return { bg: "#e2e8f0", text: "#64748b" };
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function formatRemainingDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

/**
 * OPTIMIZATION: OfferCard is memoized to prevent unnecessary re-renders
 * when parent RequestDetailScreen updates but this offer's data is unchanged.
 *
 * The parent may re-render due to state changes (loading, modal visibility),
 * socket updates, or transaction status changes. Without memoization, every
 * offer card would re-render even when the offer data hasn't changed, causing
 * jank and performance degradation in offer history with many entries.
 *
 * Shallow equality works here because:
 * - offer object reference is stable from the request detail query payload
 * - session/theme come from hooks (stable across renders)
 * - router is stable from useRouter hook
 * - index prop is derived cleanly
 *
 * IMPACT: Scrolling/expanding offer history remains smooth (60 FPS) even when
 * parent is updating for unrelated reasons.
 */
const OfferCard = memo(
  function OfferCard({
    offer,
    index,
    totalCount,
    sessionUserId,
    sessionProfilePicture,
    theme,
    router,
    styles: passedStyles,
  }: {
    offer: any; // RequestOfferSummary
    index: number;
    totalCount: number;
    sessionUserId: string;
    sessionProfilePicture: string | null;
    theme: any; // AppTheme
    router: ReturnType<typeof useRouter>;
    styles: any; // StyleSheet
  }) {
    const firstName = offer.offeredById === sessionUserId ? "You" : getFirstName(offer.offeredBy?.userName);
    const offeredByLabel = firstName || "User";
    const offeredByAvatar =
      offer.offeredById === sessionUserId
        ? sessionProfilePicture
        : offer.offeredBy?.profilePicture ?? null;
    const statusStyle = getOfferStatusBadgeStyle(offer.status);
    const statusBadge = (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: statusStyle.bg,
        }}
      >
        <Text
          style={{
            color: statusStyle.text,
            fontWeight: offer.status === "ACTIVE" ? "bold" : "600",
            fontSize: 11,
            letterSpacing: offer.status === "ACTIVE" ? 0.5 : 0,
          }}
        >
          {offer.status === "SUPERSEDED" ? "CANCELLED" : offer.status}
        </Text>
      </View>
    );

    return (
      <CollapsibleSection
        key={offer.id}
        title={`Offer #${totalCount - index}`}
        subtitle={`By ${offeredByLabel}`}
        leftElement={
          offeredByAvatar ? (
            <AppImage uri={offeredByAvatar} style={passedStyles.offerAvatarImage} />
          ) : (
            <View
              style={[
                passedStyles.offerAvatarFallback,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            >
              <Text style={[passedStyles.offerAvatarInitials, { color: theme.colors.textSecondary }]}>
                {toInitials(offeredByLabel)}
              </Text>
            </View>
          )
        }
        rightElement={statusBadge}
        themeColors={{
          textPrimary: theme.colors.textPrimary,
          textSecondary: theme.colors.textSecondary,
          surface: theme.colors.surface,
          border: theme.colors.border,
        }}
        maxHeight={600}
      >
        {offer.type !== "NONE" && (
          <View style={passedStyles.detailRow}>
            <Text style={[passedStyles.label, { color: theme.colors.textMuted }]}>Type</Text>
            <Text style={[passedStyles.value, { color: theme.colors.textPrimary }]}>
              {getOfferTypeLabel(offer.type)}
            </Text>
          </View>
        )}

        {offer.offeredAmount && (
          <View style={passedStyles.detailRow}>
            <Text style={[passedStyles.label, { color: theme.colors.textMuted }]}>Amount</Text>
            <Text style={[passedStyles.value, { color: theme.colors.textPrimary }]}>₹{offer.offeredAmount}</Text>
          </View>
        )}

        {offer.offeredProducts.length > 0 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={[passedStyles.label, { color: theme.colors.textMuted }]}>Offered listings</Text>
            {offer.offeredProducts.map((op: any) => (
              <ProductCard
                key={op.id}
                product={op.product}
                showMeta={false}
                onPress={() => router.push(`/(app)/products/${op.product.id}`)}
              />
            ))}
          </View>
        )}

        {offer.requestedProducts?.length > 0 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={[passedStyles.label, { color: theme.colors.textMuted }]}>Requested in return</Text>
            {offer.requestedProducts.map((rp: any) => (
              <ProductCard
                key={rp.id}
                product={rp.product}
                showMeta={false}
                onPress={() => router.push(`/(app)/products/${rp.product.id}`)}
              />
            ))}
          </View>
        )}
      </CollapsibleSection>
    );
  },
);

function OtpExpiryInfo({
  expiresAt,
  textColor,
  onExpire,
}: {
  expiresAt: string | null;
  textColor: string;
  onExpire: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expireNotifiedRef = useRef(false);
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const remainingMs = Number.isFinite(expiresAtMs) ? Math.max(0, expiresAtMs - nowMs) : 0;
  const isExpired = !Number.isFinite(expiresAtMs) || remainingMs <= 0;

  useEffect(() => {
    expireNotifiedRef.current = false;
    setNowMs(Date.now());
  }, [expiresAt]);

  useEffect(() => {
    if (isExpired) {
      if (!expireNotifiedRef.current) {
        expireNotifiedRef.current = true;
        onExpire();
      }
      return;
    }

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isExpired, onExpire]);

  return (
    <>
      <Text style={[styles.feedbackText, { color: textColor, marginTop: 0 }]}>
        {isExpired
          ? "OTP expired. You can regenerate it now."
          : `OTP generated. Time remaining ${formatRemainingDuration(remainingMs)}.`}
      </Text>
      <Text style={[styles.feedbackText, { color: textColor, marginTop: 0 }]}>
        It can be regenerated after current OTP expires.
      </Text>
    </>
  );
}

/** Isolated expand/collapse section for a product list. State is local so toggling never re-renders RequestDetailScreen. */
const ExpandableProductsSection = memo(function ExpandableProductsSection({
  label,
  products,
  onPressProduct,
}: {
  label: string;
  products: ProductSummary[];
  onPressProduct: (id: string) => void;
}) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={[
          styles.offerHistoryHeader,
          { marginTop: 4, paddingVertical: 6, paddingHorizontal: 2 },
        ]}
      >
        <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 }]}>
          {label} ({products.length})
        </Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.colors.textSecondary}
        />
      </Pressable>
      <SmoothCollapse expanded={expanded} maxHeight={460}>
        {products.length > 2 ? (
          <ScrollView style={{ maxHeight: 440 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View style={styles.offeredProducts}>
              {products.map((product) => (
                <View key={product.id} style={styles.considerationProductWrap}>
                  <ProductCard
                    product={product}
                    showMeta={false}
                    onPress={() => onPressProduct(product.id)}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.offeredProducts}>
            {products.map((product) => (
              <View key={product.id} style={styles.considerationProductWrap}>
                <ProductCard
                  product={product}
                  showMeta={false}
                  onPress={() => onPressProduct(product.id)}
                />
              </View>
            ))}
          </View>
        )}
      </SmoothCollapse>
    </>
  );
});

const OFFERS_PAGE_SIZE = 10;
const OFFER_ITEM_ESTIMATED_HEIGHT = 64;
const OFFER_LIST_MAX_HEIGHT = OFFERS_PAGE_SIZE * OFFER_ITEM_ESTIMATED_HEIGHT + 32; // item height * page size + some padding

const OfferHistorySection = memo(function OfferHistorySection({
  offers,
  sessionUserId,
  sessionProfilePicture,
  router,
  theme,
  passedStyles,
}: {
  offers: any[]; // RequestOfferSummary[]
  sessionUserId: string;
  sessionProfilePicture: string | null;
  router: ReturnType<typeof useRouter>;
  theme: any; // AppTheme
  passedStyles: any; // StyleSheet
}) {
  const [visibleOffersCount, setVisibleOffersCount] = useState(OFFERS_PAGE_SIZE);
  const visibleOffers = useMemo(() => offers.slice(0, visibleOffersCount), [offers, visibleOffersCount]);
  const hasMoreOffers = offers.length > visibleOffersCount;

  if(offers.length === 0) {
    return <View style={{ gap: 10 }}>
    <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginLeft: 4 }]}>Offer History</Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No offers yet.</Text>
      </View>
    </View>;
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginLeft: 4 }]}>Offer History ({offers.length})</Text>
      <View style={{ maxHeight: OFFER_LIST_MAX_HEIGHT }}>
        <ScrollView style={{maxHeight: OFFER_LIST_MAX_HEIGHT}} nestedScrollEnabled showsVerticalScrollIndicator>
          <View style={{gap: 8}}>
            {visibleOffers.map((offer, index) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                index={index}
                totalCount={offers.length}
                sessionUserId={sessionUserId}
                sessionProfilePicture={sessionProfilePicture}
                router={router}
                styles={passedStyles}
                theme={theme}
              />
            ))}
            {hasMoreOffers ? (
            <Pressable
              onPress={() => setVisibleOffersCount((count) => count + OFFERS_PAGE_SIZE)}
              style={{
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                marginTop: 4,
              }}
            >
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>Load more offers</Text>
            </Pressable>
          ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
});

export default function RequestDetailScreen() {
  const router = useRouter();
  const { theme, statusBarStyle } = useAppTheme();
  const dialog = useAppDialog();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";
  useRequestRoom(requestId || null);

  const session = useSession();
  const requestQuery = useRequestDetailQuery(requestId);
  const queryClient = useQueryClient();

  const shouldCheckActiveTransaction =
    (requestQuery.data?.status === "ACCEPTED" && requestQuery.data.product.status !== "EXCHANGED") ||
    Boolean(queryClient.getQueryData(queryKeys.transactions.activeByRequest(requestId)));

const transactionQuery = useActiveTransactionQuery(requestId, shouldCheckActiveTransaction);
  useTransactionRoom(transactionQuery.data?.id ?? null);
  useRealtimeToastScope(
    requestId
      ? {
          type: "request",
          requestId,
          ...(requestQuery.data?.productId ? { productId: requestQuery.data.productId } : {}),
        }
      : { type: "none" },
  );

  const acceptMutation = useAcceptRequestMutation();
  const rejectMutation = useRejectRequestMutation();
  const cancelMutation = useCancelRequestMutation();
  const cancelAllRequestsForProductMutation = useCancelAllRequestsForProductMutation();
  const requestContactRevealMutation = useRequestContactRevealMutation();
  const respondContactRevealMutation = useRespondContactRevealMutation();
  const updateProfileMutation = useUpdateProfileMutation();
  const counterOfferMutation = useCreateCounterOfferMutation();
  const ownProducts = useProductsListController(
    {
      ownerId: session?.user.id,
      status: "ACTIVE",
      limit: 60,
    },
    { enabled: Boolean(session?.user.id) },
  );
  const generateOtpMutation = useGenerateTransactionOtpMutation();
  const verifyOtpMutation = useVerifyTransactionOtpMutation();

  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [generatedOtpExpiresAt, setGeneratedOtpExpiresAt] = useState<string | null>(null);
  const [isGeneratedOtpExpired, setIsGeneratedOtpExpired] = useState(false);
  const [txFeedback, setTxFeedback] = useState<string | null>(null);
  const [showCounterOfferForm, setShowCounterOfferForm] = useState(false);
  const [considerationTab, setConsiderationTab] = useState<"yours" | "theirs">("yours");
  const onPressConsiderationProduct = useCallback(
    (id: string) => { router.push(`/(app)/products/${id}`); },
    [router],
  );
  const [contactEmailInput, setContactEmailInput] = useState("");
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [contactFieldErrors, setContactFieldErrors] = useState<{
    email?: string;
    mobileNumber?: string;
  }>({});
  const [contactUpdateMessage, setContactUpdateMessage] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [showContactDetailsModal, setShowContactDetailsModal] = useState(false);

  const [, rerender] = useState(0);

  const onRefreshPage = () => {
    if (isManualRefreshing) {
      return;
    }

    setIsManualRefreshing(true);

    void Promise.allSettled([
      requestQuery.refetch(),
      shouldCheckActiveTransaction ? transactionQuery.refetch() : Promise.resolve(),
    ]).finally(() => {
      setIsManualRefreshing(false);
    });
  };

  useEffect(() => {
    setContactEmailInput(session?.user.email ?? "");
    setContactPhoneInput(session?.user.mobileNumber ?? "");
    setContactFieldErrors({});
  }, [session?.user.email, session?.user.mobileNumber]);

  const tx = transactionQuery.data;
  const sellerOtpActive =
  session?.user.id === transactionQuery.data?.sellerId &&
  tx?.status === "IN_PROGRESS" &&
  (
    !tx.otpExpiresAt || // if server doesn't send it, show the field
    new Date(tx.otpExpiresAt).getTime() > Date.now()
  );

  useEffect(() => {
    if (!tx?.otpExpiresAt) return;

    const msUntilExpiry = new Date(tx.otpExpiresAt).getTime() - Date.now();
    if (msUntilExpiry <= 0) return;

    const timer = setTimeout(() => {
      rerender((n) => n + 1)
    }, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [tx?.otpExpiresAt]);

  useEffect(() => {
    if (!sellerOtpActive) {
      setOtpInput("");
      setTxFeedback(null);
    }
  }, [sellerOtpActive]);

  const onRequestContactReveal = async () => {
    if (viewerMissingContactInfo) {
      await dialog.alert(
        "Contact Details Missing",
        `Add your ${contactRequirementsLabel} so the other party can reach you after approval.`,
      );
      return;
    }

    try {
      await requestContactRevealMutation.mutateAsync({
        requestId: request.id,
        payload: {},
      });
      await dialog.alert(
        "Request Sent",
        "The other party will be notified. Contact details will be visible to both once approved.",
      );
    } catch (error) {
      await dialog.alert("Request failed", toRequestErrorMessage(error));
    }
  };

  const onPressRequestContactReveal = useCallback(() => {
    void (async () => {
      const shouldRequest = await dialog.confirm(
        "Request Contact Reveal",
        "Both parties will see each other's contact details once approved. Do you want to proceed?",
        {
          confirmLabel: "Send Request",
          cancelLabel: "Cancel",
        },
      );
      if (shouldRequest) {
        void onRequestContactReveal();
      }
    })();
  }, [dialog, onRequestContactReveal]);

  if (!session) {
    return null;
  }

  if (requestQuery.isPending) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Spinner size={30} />
        </View>
      </SafeAreaView>
    );
  }

  if (requestQuery.error || !requestQuery.data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <ErrorView
          title="Request not found"
          message="We couldn't load this request. It may have been deleted or you don't have access to it."
          buttons={[
            {
              label: "Retry",
              onPress: () => void requestQuery.refetch(),
            },
            {
              label: "Back",
              variant: "ghost",
              onPress: () => router.back(),
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  const request = requestQuery.data;
  const isBuyer = session.user.id === request.buyerId;
  const isSeller = session.user.id === request.sellerId;
  const counterparty = isBuyer ? request.seller : request.buyer;
  const revealState = request.contactReveal;
  const actorTurn = isBuyer ? "BUYER" : "SELLER";
  const isExchangeFinalized = request.product.status === "EXCHANGED";
  const isReservedProductUsedInOtherOffers = Boolean((request as any).isReservedProductUsedInOtherOffers);
  const showContactRevealSection = request.status === "ACCEPTED" && request.product.status === "RESERVED" && !isReservedProductUsedInOtherOffers;

  const ownOfferableProducts = ownProducts.items;
  const canActByTurn = OPEN_STATUSES.includes(request.status) && request.currentTurn === actorTurn;
  const canCounter = !request.product.isFree && OPEN_STATUSES.includes(request.status) && request.currentTurn === actorTurn;
  const orderedOffers = [...request.offers].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const activeOffer = orderedOffers[0] ?? request.offers[request.offers.length - 1];
  const latestActiveOffer = activeOffer?.status === "ACTIVE" ? activeOffer : null;
  const historyOffers = orderedOffers;

  // Effective minimum for buyer's money offer:
  // Start with the product's minMoneyAmount (seller-set floor).
  // If the seller has already countered with a lower amount, the floor drops to that value,
  // because the seller has implicitly signalled they'll accept less.
  // Sellers have no minimum — they define the terms.
  const parsedProductMinAmount =
    request.product.minMoneyAmount != null && Number.isFinite(Number(request.product.minMoneyAmount))
      ? Number(request.product.minMoneyAmount)
      : null;
  const productMinAmount =
    parsedProductMinAmount != null && parsedProductMinAmount > 0 ? parsedProductMinAmount : null;
  const lastSellerOfferAmount = isBuyer
    ? orderedOffers
        .filter((o) => o.offeredById === request.sellerId)
        .map((o) => (o.offeredAmount != null ? Number(o.offeredAmount) : null))
        .find((v): v is number => v !== null) ?? null
    : null;
  const effectiveMinAmount: number | null = isBuyer && productMinAmount != null
    ? lastSellerOfferAmount != null
      ? Math.min(productMinAmount, lastSellerOfferAmount)
      : productMinAmount
    : null;

  // Previous offer from the current user for comparison
  const userLastOffer = orderedOffers.find((o) => o.offeredById === session.user.id);
  const previousOffer = userLastOffer ? {
    amount: userLastOffer.offeredAmount,
    productCount: userLastOffer.offeredProducts?.length ?? 0,
  } : undefined;
  const latestOwnOfferedProductIds = Array.from(new Set(
    (userLastOffer?.offeredProducts ?? [])
      .map((op) => op.productId ?? op.product?.id)
      .filter((id): id is string => typeof id === "string")
  )).filter((id) => ownOfferableProducts.some((p) => p.id === id));

  
  const generatedOtpExpiresAtMs = generatedOtpExpiresAt ? new Date(generatedOtpExpiresAt).getTime() : null;
  const hasGeneratedOtpExpiredByClock =
    generatedOtp != null && (generatedOtpExpiresAtMs == null || generatedOtpExpiresAtMs <= Date.now());
  const buyerOtpExpired = generatedOtp != null && (isGeneratedOtpExpired || hasGeneratedOtpExpiredByClock);
  const canGenerateBuyerOtp = !generatedOtp || buyerOtpExpired;
  const isRequestCompleted =
    request.status === "COMPLETED" ||
    (request.status === "ACCEPTED" && (isExchangeFinalized || (!transactionQuery.isPending && !tx)));
  const canCancel = OPEN_STATUSES.includes(request.status) || (request.status === "ACCEPTED" && !isRequestCompleted);
  const displayStatus: RequestSummary["status"] = isRequestCompleted ? "COMPLETED" : request.status;
  const showPendingTurnDetails = OPEN_STATUSES.includes(request.status) && Boolean(request.currentTurn);
  const acceptedTurnLabel =
    request.status !== "ACCEPTED" || isRequestCompleted || !tx
      ? null
      : tx.status === "INITIATED"
        ? isBuyer
          ? "Your turn"
          : "Their turn"
        : tx.status === "IN_PROGRESS"
          ? isBuyer
            ? (canGenerateBuyerOtp ? "Your turn" : "Their turn")
            : "Your turn"
          : null;

  const showAcceptedTurnDetails = Boolean(acceptedTurnLabel);
  const showRequestDetailsSection =
    showPendingTurnDetails || showAcceptedTurnDetails || (request.status === "ACCEPTED" && canCancel);
  
  const showTransactionSection =
    request.status === "ACCEPTED" && !isRequestCompleted && !isReservedProductUsedInOtherOffers && (transactionQuery.isPending || Boolean(tx));
  const canViewCounterpartyContact = Boolean(revealState?.contactVisible);
  const showPhone =
    canViewCounterpartyContact &&
    (request.contactPreference === "PHONE" || request.contactPreference === "BOTH") &&
    Boolean(counterparty.mobileNumber);
  const viewerEmail = session.user.email ?? "";
  const viewerPhone = session.user.mobileNumber ?? "";
  const showEmail =
    canViewCounterpartyContact &&
    (request.contactPreference === "EMAIL" || request.contactPreference === "BOTH");
  const viewerNeedsEmail =
    request.contactPreference === "EMAIL" || request.contactPreference === "BOTH";
  const viewerNeedsPhone =
    request.contactPreference === "PHONE" || request.contactPreference === "BOTH";
  const missingViewerEmail = viewerNeedsEmail && viewerEmail.trim().length === 0;
  const missingViewerPhone = viewerNeedsPhone && viewerPhone.trim().length === 0;
  const viewerMissingContactInfo = missingViewerEmail || missingViewerPhone;
  const contactRequirementsLabel = request.contactPreference === "BOTH"
    ? "email and phone"
    : request.contactPreference === "PHONE"
      ? "phone"
      : "email";

  const onSaveMissingContactInfo = async () => {
    const trimmedEmail = contactEmailInput.trim();
    const trimmedPhone = normalizePhone(contactPhoneInput);
    const nextErrors: { email?: string; mobileNumber?: string } = {};

    if (viewerNeedsEmail) {
      if (trimmedEmail.length === 0) {
        nextErrors.email = "Email is required for this request.";
      } else if (!isValidEmail(trimmedEmail)) {
        nextErrors.email = "Enter a valid email address.";
      }
    }

    if (viewerNeedsPhone) {
      if (trimmedPhone.length === 0) {
        nextErrors.mobileNumber = "Phone number is required for this request.";
      } else if (trimmedPhone.length < 10 || trimmedPhone.length > 15) {
        nextErrors.mobileNumber = "Phone number must be 10 to 15 digits.";
      }
    }

    setContactFieldErrors(nextErrors);
    setContactUpdateMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return false;
    }

    try {
      await updateProfileMutation.mutateAsync({
        ...(viewerNeedsEmail ? { email: trimmedEmail } : {}),
        ...(viewerNeedsPhone ? { mobileNumber: trimmedPhone } : {}),
      });
      setContactUpdateMessage("Contact details updated.");
      return true;
    } catch (error) {
      setContactUpdateMessage(toProfileErrorMessage(error));
      return false;
    }
  };

  const onRespondContactReveal = async (approve: boolean) => {
    const revealRequestId = revealState?.incomingRequestId;
    if (!revealRequestId) {
      return;
    }

    if (approve && viewerMissingContactInfo) {
      await dialog.alert(
        "Add Contact Details",
        `Add your ${contactRequirementsLabel} before approving contact reveal so both sides can immediately see usable contact information.`,
      );
      return;
    }

    try {
      await respondContactRevealMutation.mutateAsync({
        requestId: request.id,
        revealRequestId,
        payload: { approve },
      });
      await dialog.alert(
        approve ? "Contact Details Revealed" : "Request Declined",
        approve
          ? "Contact details are now visible to both parties."
          : "The contact reveal request has been declined. Either party may submit a new request at any time.",
      );
    } catch (error) {
      await dialog.alert("Action failed", toRequestErrorMessage(error));
    }
  };

  const onSubmitCounterOffer = async (payload: {
    offerType: "PRODUCT" | "MONEY" | "MIXED" | "NONE";
    offeredProducts?: string[];
    visibleProducts?: string[];
    requestedProducts?: string[];
    amount?: number;
    message?: string;
  }) => {
    try {
      await counterOfferMutation.mutateAsync({ requestId: request.id, payload });
      setShowCounterOfferForm(false);
    } catch (error) {
      throw new Error(toRequestErrorMessage(error));
    }
  };

  const onGenerateOtp = async () => {
    if (!tx) return;
    setTxFeedback(null);

    try {
      const result = await generateOtpMutation.mutateAsync(tx.id);
      if (!result) {
        setTxFeedback("Action already submitted. Refreshing latest status.");
        await transactionQuery.refetch();
        return;
      }

      setGeneratedOtp(result.otp);
      setGeneratedOtpExpiresAt(result.expiresAt);
      setIsGeneratedOtpExpired(false);
      setTxFeedback(null);
    } catch (error) {
      setTxFeedback(toTransactionErrorMessage(error));
    }
  };

  const onVerifyOtp = async (otp?: string) => {
    if (!tx) return;
    setTxFeedback(null);

    try {
      await verifyOtpMutation.mutateAsync({ transactionId: tx.id, otp: (otp ?? otpInput).trim() });
      setOtpInput("");
      setGeneratedOtp(null);
      setGeneratedOtpExpiresAt(null);
      setIsGeneratedOtpExpired(false);
      setTxFeedback("OTP verified. Transaction completed.");
    } catch (error) {
      setTxFeedback(toTransactionErrorMessage(error));
    }
  };

  const counterpartyProductMap = new Map<string, ProductSummary>();

  request.visibleProducts.forEach((visible) => {
    const productOwnerId = visible.product.owner?.id ?? visible.product.currentOwnerId;
    if (productOwnerId === counterparty.id) {
      counterpartyProductMap.set(visible.product.id, visible.product);
    }
  });

  orderedOffers.forEach((offer) => {
    if (offer.offeredById !== counterparty.id) {
      return;
    }

    offer.offeredProducts.forEach((offeredProduct) => {
      counterpartyProductMap.set(offeredProduct.product.id, offeredProduct.product);
    });
  });

  const counterpartyProductsForCounter = Array.from(counterpartyProductMap.values());
  const latestRequesterProductIds = Array.from(new Set([
    ...(activeOffer?.requestedProducts?.map((rp) => rp.productId) ?? []),
    ...(activeOffer?.offeredById === counterparty.id
      ? (activeOffer.offeredProducts?.map((op) => op.productId) ?? [])
      : []),
  ])).filter((id) => counterpartyProductsForCounter.some((p) => p.id === id));
  const latestOfferAmount = activeOffer?.offeredAmount ?? null;

  // Build a cumulative pool from ALL offers in the thread so products persist across counter offers
  const viewerPoolMap = new Map<string, ProductSummary>();
  const counterpartyPoolMap = new Map<string, ProductSummary>();

  orderedOffers.forEach((offer) => {
    const byViewer = offer.offeredById === session.user.id;
    const targetMap = byViewer ? viewerPoolMap : counterpartyPoolMap;
    offer.offeredProducts.forEach((op) => {
      if (!targetMap.has(op.product.id)) targetMap.set(op.product.id, op.product);
    });
  });

  request.visibleProducts.forEach((vp) => {
    const byViewer = (vp.product.owner?.id ?? vp.product.currentOwnerId) === session.user.id;
    const targetMap = byViewer ? viewerPoolMap : counterpartyPoolMap;
    if (!targetMap.has(vp.product.id)) targetMap.set(vp.product.id, vp.product);
  });

  const yourConsiderationProducts = Array.from(viewerPoolMap.values());
  const theirConsiderationProducts = Array.from(counterpartyPoolMap.values());
  const hasConsiderationProducts = viewerPoolMap.size > 0 || counterpartyPoolMap.size > 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <MenuHeader
        onBack={() => router.back()}
        textColor={theme.colors.textPrimary}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 10 }]}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={onRefreshPage}
          />
        }
      >
        {/* Request Header */}
        <View style={[styles.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={3}>{request.product.title}</Text>
            <StatusBadge status={displayStatus} />
          </View>
        </View>

        {/* Product Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Requested product</Text>
          <ProductCard
            product={request.product}
            showMeta={false}
            onPress={() => router.push(`/(app)/products/${request.product.id}`)}
          />

        {/* Listing Used in Other Outgoing Requests — shown only to the seller */}
        {isReservedProductUsedInOtherOffers && isSeller ? (
          <View
            style={[
              styles.card,
              {
                // backgroundColor: theme.mode === "dark" ? "#1c1a10" : "#fffbeb",
                borderColor: theme.mode === "dark" ? "#4d3d00" : "#fde68a",
              },
            ]}
          >
            {/* Header row with warning icon */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <Feather name="alert-triangle" size={16} color={theme.mode === "dark" ? "#fbbf24" : "#d97706"} />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: theme.mode === "dark" ? "#fbbf24" : "#92400e",
                    marginBottom: 0,
                  },
                ]}
              >
                Listing Used in Another Request
              </Text>
            </View>

            <Text
              style={[
                styles.feedbackText,
                {
                  color: theme.mode === "dark" ? "#d4aa50" : "#92400e",
                  marginTop: 4,
                },
              ]}
            >
              <Text style={{ fontWeight: "700" }}>{request.product.title}</Text>
              {" "}is offered in another request. Cancel conflicts to finalise this one.
            </Text>

            <View style={[styles.offerActionButtonsRow, { marginTop: 8 }]}>
              {/* View outgoing requests that use this listing */}
              <View style={styles.offerActionButtonCell}>
                <Button
                  label="View Requests"
                  disabled={cancelAllRequestsForProductMutation.isPending}
                  variant="ghost"
                  style={{
                    minHeight: 36,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.mode === "dark" ? "#4d3d00" : "#fbbf24",
                    backgroundColor: theme.mode === "dark" ? "#2a2000" : "#fef9ee",
                  }}
                  textColor={theme.mode === "dark" ? "#fbbf24" : "#b45309"}
                  labelStyle={{ fontWeight: "700", fontSize: 13 }}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/(tabs)/requests",
                      params: { tab: "sent", _t: Date.now().toString() },
                    })
                  }
                />
              </View>

              {/* Cancel all outgoing requests that use this listing */}
              <View style={styles.offerActionButtonCell}>
                <Button
                  label="Cancel All"
                  variant="ghost"
                  disabled={cancelAllRequestsForProductMutation.isPending}
                  style={{
                    minHeight: 36,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.colors.danger,
                    backgroundColor: theme.mode === "dark" ? theme.colors.surface : "#fff",
                  }}
                  textColor={theme.colors.danger}
                  labelStyle={{ fontWeight: "700", fontSize: 13 }}
                  onPress={() => {
                    void (async () => {
                      const confirmed = await dialog.confirm(
                        "Cancel All Conflicting Requests",
                        `Cancel all outgoing requests offering "${request.product.title}"? This cannot be undone.`,
                        {
                          confirmLabel: "Cancel All",
                          cancelLabel: "Go Back",
                        },
                      );

                      if (!confirmed) return;

                      try {
                        await cancelAllRequestsForProductMutation.mutateAsync({
                          requestId: request.id,
                          reason: "Cancelled conflicting outgoing requests",
                        });
                      } catch (error) {
                        void dialog.alert("Error", toRequestErrorMessage(error));
                      }
                    })();
                  }}
                  loading={cancelAllRequestsForProductMutation.isPending}
                />
              </View>
            </View>
          </View>
        ) : null}
        </View>

        {/* Request Details */}
        {showRequestDetailsSection ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Request Details</Text>
              {canCancel ? (
                <Pressable
                  onPress={() =>
                    cancelMutation
                      .mutateAsync({ requestId: request.id, reason: "Cancelled from app" })
                      .catch((error) => {
                        void dialog.alert("Error", toRequestErrorMessage(error));
                      })
                  }
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: theme.colors.danger,
                      backgroundColor: pressed ? (theme.mode === "dark" ? theme.colors.border : "#fee2e2") : (theme.mode === "dark" ? theme.colors.surface : "#fff"),
                      opacity: cancelMutation.isPending ? 0.6 : 1,
                    },
                  ]}
                  disabled={cancelMutation.isPending}
                >
                  <Text style={{ color: theme.colors.danger, fontWeight: "700", fontSize: 12 }}>
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {showPendingTurnDetails ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Turn</Text>
                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                  {request.currentTurn === actorTurn ? "Your turn" : "Their turn"}
                </Text>
              </View>
            ) : showAcceptedTurnDetails ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Turn</Text>
                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                  {acceptedTurnLabel}
                </Text>
              </View>
            ) : null}

            {showPendingTurnDetails && latestActiveOffer && latestActiveOffer.type !== "NONE" ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={[styles.label, { color: theme.colors.textMuted }]}>Latest Offer</Text>
                  <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                    {getOfferTypeLabel(latestActiveOffer.type)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.label, { color: theme.colors.textMuted }]}>By</Text>
                  <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                    {latestActiveOffer.offeredBy?.userName || "Unknown"}
                  </Text>
                </View>

                {latestActiveOffer.offeredAmount && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.label, { color: theme.colors.textMuted }]}>Amount</Text>
                    <Text style={[styles.value, { color: theme.colors.textPrimary }]}>₹{latestActiveOffer.offeredAmount}</Text>
                  </View>
                )}

                {latestActiveOffer.offeredProducts.length > 0 && (
                  <View style={styles.offeredProducts}>
                    <Text style={[styles.offerBy, { color: theme.colors.textMuted }]}>Offered listings</Text>
                    {latestActiveOffer.offeredProducts.map((op) => (
                      <View key={op.id} style={{ marginTop: 8 }}>
                        <ProductCard
                          product={op.product}
                          showMeta={false}
                          onPress={() => router.push(`/(app)/products/${op.product.id}`)}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {latestActiveOffer.requestedProducts?.length > 0 && (
                  <View style={styles.offeredProducts}>
                    <Text style={[styles.offerBy, { color: theme.colors.textMuted }]}>Requested in return</Text>
                    {latestActiveOffer.requestedProducts.map((rp) => (
                      <View key={rp.id} style={{ marginTop: 8 }}>
                        <ProductCard
                          product={rp.product}
                          showMeta={false}
                          onPress={() => router.push(`/(app)/products/${rp.product.id}`)}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons: Accept/Reject/Counter */}
                {canActByTurn && (
                  <View style={styles.offerActionButtonsRow}>
                    <View style={styles.offerActionButtonCell}>
                      <Button
                        label="Accept"
                        style={{
                          minHeight: 32,
                          borderRadius: 10,
                          paddingHorizontal: 18,
                          paddingVertical: 0,
                        }}
                        onPress={() =>
                          acceptMutation.mutateAsync(request.id).catch((error) => {
                            void dialog.alert("Error", toRequestErrorMessage(error));
                          })
                        }
                        loading={acceptMutation.isPending}
                      />
                    </View>
                    <View style={styles.offerActionButtonCell}>
                      <Button
                        label="Reject"
                        variant="ghost"
                        style={{
                          minHeight: 32,
                          borderRadius: 10,
                          paddingHorizontal: 18,
                          paddingVertical: 0,
                          backgroundColor: theme.mode === "dark" ? theme.colors.surface : "#fff",
                          borderColor: theme.colors.danger,
                          borderWidth: 1,
                        }}
                        textColor={theme.colors.danger}
                        labelStyle={{ fontWeight: "700" }}
                        onPress={() =>
                          rejectMutation.mutateAsync(request.id).catch((error) => {
                            void dialog.alert("Error", toRequestErrorMessage(error));
                          })
                        }
                        loading={rejectMutation.isPending}
                      />
                    </View>
                  </View>
                )}

                {canCounter && (
                  <Button
                    label="Counter Offer"
                    variant="ghost"
                    style={{
                      minHeight: 36,
                      borderRadius: 10,
                      marginTop: 2,
                      backgroundColor: theme.mode === "dark" ? theme.colors.surfaceMuted : "#fff",
                      borderWidth: 1,
                      borderColor: theme.mode === "dark" ? theme.colors.primary : theme.colors.border,
                    }}
                    textColor={theme.mode === "dark" ? theme.colors.textPrimary : theme.colors.textSecondary}
                    labelStyle={{ fontWeight: "700" }}
                    onPress={() => setShowCounterOfferForm(true)}
                  />
                )}
              </>
            ) : null}

            {showPendingTurnDetails && request.message ? (
              <View style={styles.messageSection}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Message</Text>
                <View
                  style={[
                    styles.messageCard,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.messageText, { color: theme.colors.textPrimary }]}>{request.message}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {hasConsiderationProducts && !OPEN_STATUSES.includes(request.status) ? null : hasConsiderationProducts ? (() => {
          const showTabs = yourConsiderationProducts.length > 0 && theirConsiderationProducts.length > 0;
          const activeProducts = showTabs
            ? (considerationTab === "yours" ? yourConsiderationProducts : theirConsiderationProducts)
            : yourConsiderationProducts.length > 0
              ? yourConsiderationProducts
              : theirConsiderationProducts;
          const singleSideLabel = yourConsiderationProducts.length > 0 ? "Yours" : "Requester's Products";
          const showingYourProducts = showTabs
            ? considerationTab === "yours"
            : singleSideLabel === "Yours";
          const showingRequesterProducts = showTabs
            ? considerationTab === "theirs"
            : singleSideLabel === "Requester's Products";

          return (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Products for consideration</Text>
              <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>These products are offered by the requester and are available to include in counter offer, if relevant.</Text>
              {showTabs ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Pressable
                    onPress={() => setConsiderationTab("yours")}
                    style={[
                      { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center", borderWidth: 1 },
                      considerationTab === "yours"
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: considerationTab === "yours" ? theme.colors.onPrimary : theme.colors.textSecondary }}>
                      Yours ({yourConsiderationProducts.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setConsiderationTab("theirs")}
                    style={[
                      { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center", borderWidth: 1 },
                      considerationTab === "theirs"
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: considerationTab === "theirs" ? theme.colors.onPrimary : theme.colors.textSecondary }}>
                      Requester's Products ({theirConsiderationProducts.length})
                    </Text>
                  </Pressable>
                </View>
              ) : (
                singleSideLabel !== "Requester's Products" && singleSideLabel !== "Yours" ? (
                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.textMuted, marginTop: 2 }}>{singleSideLabel}</Text>
                ) : null
              )}
              {showingYourProducts ? (
                <ExpandableProductsSection
                  label="Yours"
                  products={activeProducts}
                  onPressProduct={onPressConsiderationProduct}
                />
              ) : showingRequesterProducts ? (
                <ExpandableProductsSection
                  label="Requester's Products"
                  products={activeProducts}
                  onPressProduct={onPressConsiderationProduct}
                />
              ) : activeProducts.length > 2 ? (
                <ScrollView
                  style={{ maxHeight: 440 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.offeredProducts}>
                    {activeProducts.map((product) => (
                      <View key={product.id} style={{ marginTop: 8 }}>
                        <ProductCard
                          product={product}
                          showMeta={false}
                          onPress={() => router.push(`/(app)/products/${product.id}`)}
                        />
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.offeredProducts}>
                  {activeProducts.map((product) => (
                    <View key={product.id} style={{ marginTop: 8 }}>
                      <ProductCard
                        product={product}
                        showMeta={false}
                        onPress={() => router.push(`/(app)/products/${product.id}`)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })() : null}

        {showContactRevealSection ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Contact Info</Text>
            {!revealState?.contactVisible ? (
              <View>
                <Text style={[styles.contactInfoHint, { color: theme.colors.textMuted }]}>Contact details are not yet visible. Either party can initiate a reveal request. Once approved, both parties will be able to view each other's contact information.</Text>
              </View>
            ) : null}

            <View style={styles.contactRow}>
              <Text style={[styles.label, { color: theme.colors.textMuted }]}>Name</Text>
              <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{counterparty.userName}</Text>
            </View>

            {showPhone ? (
              <View style={styles.contactRow}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Phone</Text>
                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{counterparty.mobileNumber}</Text>
              </View>
            ) : null}

            {showEmail ? (
              <View style={styles.contactRow}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Email</Text>
                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{counterparty.email ?? "Not available"}</Text>
              </View>
            ) : null}

            <View style={styles.contactActionsRow}>
              {revealState?.canRequestReveal ? (
                <>
                  <Button
                    label="Request Contact Details Reveal"
                    onPress={() => {
                      if (viewerMissingContactInfo) {
                        setShowContactDetailsModal(true);
                        return;
                      }
                      onPressRequestContactReveal();
                    }}
                    loading={requestContactRevealMutation.isPending}
                  />

                  {/* Floating modal for missing contact details */}
                  <FloatingModal
                    visible={showContactDetailsModal}
                    title="Add Contact Details"
                    onClose={() => {
                      setShowContactDetailsModal(false);
                      setContactFieldErrors({});
                      setContactUpdateMessage(null);
                    }}
                    preferCenter
                  >
                    <Text style={[styles.contactMissingText, { color: theme.colors.textMuted }]}>
                      Your {contactRequirementsLabel} is missing. Add it here before requesting contact reveal.
                    </Text>

                    {viewerNeedsEmail ? (
                      <Input
                        label="Email"
                        value={contactEmailInput}
                        onChangeText={(value) => {
                          setContactEmailInput(value);
                          setContactFieldErrors((current) => ({ ...current, email: undefined }));
                          setContactUpdateMessage(null);
                        }}
                        placeholder="you@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={contactFieldErrors.email ?? null}
                      />
                    ) : null}

                    {viewerNeedsPhone ? (
                      <Input
                        label="Phone"
                        value={contactPhoneInput}
                        onChangeText={(value) => {
                          setContactPhoneInput(value);
                          setContactFieldErrors((current) => ({ ...current, mobileNumber: undefined }));
                          setContactUpdateMessage(null);
                        }}
                        placeholder="Enter phone number"
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={contactFieldErrors.mobileNumber ?? null}
                      />
                    ) : null}

                    <Button
                      label="Save Contact Details"
                      onPress={async () => {
                        const saved = await onSaveMissingContactInfo();
                        if (saved) {
                          setShowContactDetailsModal(false);
                          onPressRequestContactReveal();
                        }
                      }}
                      loading={updateProfileMutation.isPending}
                    />

                    {contactUpdateMessage ? (
                      <Text
                        style={[
                          styles.contactMissingText,
                          {
                            color: contactUpdateMessage === "Contact details updated."
                              ? theme.colors.textSecondary
                              : theme.colors.danger,
                          },
                        ]}
                      >
                        {contactUpdateMessage}
                      </Text>
                    ) : null}
                  </FloatingModal>
                </>
              ) : null}

              {revealState?.canApproveIncoming && revealState.incomingRequestId ? (
                <View style={styles.contactApproveRow}>
                  <Text style={[styles.feedbackText, { color: theme.colors.textMuted, marginBottom: 4 }]}>
                    The other party has requested to reveal contact details. Once approved, both of you will be able to view each other's contact information.
                  </Text>
                  <Button
                    label="Approve Reveal"
                    disabled={viewerMissingContactInfo}
                    onPress={() => void onRespondContactReveal(true)}
                    loading={respondContactRevealMutation.isPending}
                  />
                  <Button
                    label="Decline"
                    variant="ghost"
                    onPress={() => void onRespondContactReveal(false)}
                    loading={respondContactRevealMutation.isPending}
                  />
                </View>
              ) : null}
            </View>

            {revealState?.viewerRequestStatus === "PENDING" ? (
              <View style={styles.revealInfoRow}>
                <Feather name="clock" size={14} color={theme.colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={[styles.revealInfoText, { color: theme.colors.textMuted }]}>Contact reveal request sent. Awaiting a response from the other party.</Text>
              </View>
            ) : null}

            {revealState?.viewerRequestStatus === "REJECTED" && revealState?.canRequestReveal ? (
              <Text style={[styles.feedbackText, { color: theme.colors.textMuted, marginBottom: 4 }]}>Your previous contact reveal request was declined. You may send a new request.</Text>
            ) : null}
          </View>
        ) : null}

        {/* Transaction / OTP Section */}
        {showTransactionSection && tx && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Finalize Exchange</Text>
            {isBuyer ? 
              (!generatedOtp ? <Text style={[styles.feedbackText, { color: theme.colors.textMuted, marginTop: 0 }]}>Generate OTP only after both parties have agreed to the final terms and are ready to complete the exchange.</Text> : null)
            : (
              sellerOtpActive 
              ? <Text style={[styles.feedbackText, { color: theme.colors.textMuted, marginTop: 0 }]}>The buyer has generated an OTP. Enter the code here once they share it.</Text> 
              : <Text style={[styles.feedbackText, { color: theme.colors.textMuted, marginTop: 0 }]}>The buyer generates the OTP. Enter the code here once they share it, then verify it to complete the exchange.</Text>
            )}

            {isBuyer ? (
              <>
                {generatedOtp && !buyerOtpExpired ? (
                  <View
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: theme.mode === "dark" ? "#13243f" : "#dbe8fb",
                        borderColor: theme.mode === "dark" ? "#2f4f7a" : "#b7cff4",
                      },
                    ]}
                  >
                    <OtpCodeField value={generatedOtp} editable={false} active />
                  </View>
                ) : null}

                {generatedOtp ? (
                  <OtpExpiryInfo
                    expiresAt={generatedOtpExpiresAt}
                    textColor={theme.colors.textMuted}
                    onExpire={() => setIsGeneratedOtpExpired(true)}
                  />
                ) : null}

                {canGenerateBuyerOtp ? (
                  <Button
                    label={generatedOtp ? "Regenerate OTP" : "Generate OTP"}
                    onPress={onGenerateOtp}
                    loading={generateOtpMutation.isPending}
                  />
                ) : null}
              </>
            ) : sellerOtpActive ? (
                <>
                  <OtpCodeField
                    value={otpInput}
                    onChangeText={(next) => {
                      setOtpInput(next);
                      setTxFeedback(null);
                      if (next.length === 6) {
                        void onVerifyOtp(next);
                      }
                    }}
                    editable={!verifyOtpMutation.isPending}
                    autoFocus
                    invalid={Boolean(txFeedback)}
                  />
                  {verifyOtpMutation.isPending ? (
                    <View style={{ alignItems: "center", marginTop: 4 }}>
                      <Spinner size={20} />
                    </View>
                  ) : null}
                </>
            ) : (
              null
            )}

            {txFeedback && (
              <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>{txFeedback}</Text>
            )}
          </View>
        )}

        {/* Offer History */}
        {
          <OfferHistorySection
            offers={historyOffers}
            sessionUserId={session.user.id}
            sessionProfilePicture={session.user.profilePicture ?? null}
            theme={theme}
            router={router}
            passedStyles={styles}
          />
        }

        {/* Back Button removed from bottom */}
      </ScrollView>

      {showCounterOfferForm ? (
        <SwipeableBottomSheet
          visible
          onClose={() => setShowCounterOfferForm(false)}
          title="Counter Offer"
          contentContainerStyle={styles.bottomSheetContent}
        >
          <CounterOfferForm
            product={request.product}
            ownOfferableProducts={ownOfferableProducts}
            counterpartyProducts={counterpartyProductsForCounter}
            requesterProfile={{ userName: counterparty.userName, profilePicture: counterparty.profilePicture ?? null }}
            onSubmit={onSubmitCounterOffer}
            loading={counterOfferMutation.isPending}
            onCancel={() => setShowCounterOfferForm(false)}
            isBuyer={isBuyer}
            effectiveMinAmount={effectiveMinAmount}
            canCounter={canCounter}
            userId={session.user.id}
            allOffers={orderedOffers}
            previousOffer={previousOffer}
            initialOfferedProductIds={latestOwnOfferedProductIds}
            initialVisibleProductIds={request.visibleProducts
              .map((vp) => vp.productId)
              .filter((id) => ownOfferableProducts.some((p) => p.id === id))}
            initialRequestedProductIds={latestRequesterProductIds}
            initialAmount={latestOfferAmount}
          />
        </SwipeableBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorContent: {
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  errorDescription: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  errorActions: {
    flexDirection: "row",
    width: "100%",
  },
  errorCard: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  title: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: "800" },
  description: { fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  sectionTitleNoMargin: { marginBottom: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
  },
  contactInfoHint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 6,
  },
  contactActionsRow: {
    gap: 8,
    marginTop: 6,
  },
  contactMissingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 6,
  },
  contactMissingTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  contactMissingText: {
    fontSize: 13,
    lineHeight: 19,
  },
  contactApproveRow: {
    gap: 8,
  },
  revealInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 2,
  },
  revealInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  messageSection: {
    gap: 8,
    marginTop: 2,
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  label: { fontSize: 12, fontWeight: "600" },
  value: { fontSize: 14, fontWeight: "500" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  offerHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  offerHistoryCancelButton: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  offerHistoryCancelButtonLabel: {
    fontSize: 13,
  },
  offerActionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  offerActionButtonCell: {
    flex: 1,
  },
  offersList: { gap: 10 },
  offerCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  offerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  offerBy: { fontSize: 12, fontWeight: "600" },
  offerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offerStatusText: { fontSize: 10, fontWeight: "600" },
  offerType: { fontSize: 13, fontWeight: "500" },
  offerAmount: { fontSize: 13, fontWeight: "600" },
  offerAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  offerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  offerAvatarInitials: {
    fontSize: 12,
    fontWeight: "700",
  },
  considerationProductWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  offeredProducts: { marginTop: 10, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", marginVertical: 16 },
  otpBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 12,
    marginBottom: 10,
  },
  feedbackText: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  bottomSheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});