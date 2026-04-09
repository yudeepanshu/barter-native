import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ProductSummary, RequestSummary } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useRequestDetailQuery } from "@/hooks/queries/useRequestDetailQuery";
import { useRequestOffersQuery } from "@/hooks/queries/useRequestOffersQuery";
import { useActiveTransactionQuery } from "@/hooks/queries/useActiveTransactionQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
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
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CounterOfferForm } from "@/components/requests/CounterOfferForm";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { useRequestRoom, useTransactionRoom } from "@/lib/realtime/rooms";

const OPEN_STATUSES: RequestSummary["status"][] = ["PENDING", "NEGOTIATING"];

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

export default function RequestDetailScreen() {
  const router = useRouter();
  const { theme, statusBarStyle } = useAppTheme();
  const dialog = useAppDialog();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";
  useRequestRoom(requestId || null);

  const session = useSession();
  const requestQuery = useRequestDetailQuery(requestId);
  const offersQuery = useRequestOffersQuery(requestId, { order: "desc" });
  const shouldCheckActiveTransaction =
    requestQuery.data?.status === "ACCEPTED" && requestQuery.data.product.status !== "EXCHANGED";
  const transactionQuery = useActiveTransactionQuery(
    requestId,
    shouldCheckActiveTransaction,
  );
  useTransactionRoom(transactionQuery.data?.id ?? null);

  const acceptMutation = useAcceptRequestMutation();
  const rejectMutation = useRejectRequestMutation();
  const cancelMutation = useCancelRequestMutation();
  const requestContactRevealMutation = useRequestContactRevealMutation();
  const respondContactRevealMutation = useRespondContactRevealMutation();
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
  const [txFeedback, setTxFeedback] = useState<string | null>(null);
  const [showCounterOfferForm, setShowCounterOfferForm] = useState(false);
  const [considerationTab, setConsiderationTab] = useState<"yours" | "theirs">("yours");
  const [expandRequesterProducts, setExpandRequesterProducts] = useState(false);
  const [expandYourProducts, setExpandYourProducts] = useState(false);

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
        <View style={[styles.center, styles.errorContent]}>
          <View style={[styles.errorIconContainer, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Feather name="alert-circle" size={48} color={theme.colors.danger} />
          </View>
          <Text style={[styles.errorTitle, { color: theme.colors.textPrimary }]}>Request not found</Text>
          <Text style={[styles.errorDescription, { color: theme.colors.textMuted }]}>We couldn't load this request. It may have been deleted or you don't have access to it.</Text>
          <View style={[styles.errorActions, { gap: 12 }]}>
            <Button 
              label="Retry" 
              onPress={() => void requestQuery.refetch()}
              style={{ flex: 1 }}
            />
            <Button 
              label="Back" 
              variant="ghost" 
              onPress={() => router.back()}
              style={{ flex: 1, backgroundColor: theme.mode === "dark" ? theme.colors.surface : "#fff", borderColor: theme.colors.border, borderWidth: 1 }}
            />
          </View>
        </View>
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
  const showContactRevealSection = request.status === "ACCEPTED" && request.product.status === "RESERVED";
  const showEmail = request.contactPreference === "EMAIL" || request.contactPreference === "BOTH";

  const ownOfferableProducts = ownProducts.items;
  const canActByTurn = OPEN_STATUSES.includes(request.status) && request.currentTurn === actorTurn;
  const canCounter = !request.product.isFree && OPEN_STATUSES.includes(request.status) && request.currentTurn === actorTurn;
  const orderedOffers = offersQuery.data?.offers ?? [];
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

  const tx = transactionQuery.data;
  const isRequestCompleted =
    request.status === "COMPLETED" ||
    (request.status === "ACCEPTED" && (isExchangeFinalized || (!transactionQuery.isPending && !tx)));
  const canCancel = OPEN_STATUSES.includes(request.status) || (request.status === "ACCEPTED" && !isRequestCompleted);
  const displayStatus: RequestSummary["status"] = isRequestCompleted ? "COMPLETED" : request.status;
  const showTransactionSection =
    request.status === "ACCEPTED" && !isRequestCompleted && (transactionQuery.isPending || Boolean(tx));
  const showPhone =
    (request.contactPreference === "PHONE" || request.contactPreference === "BOTH") &&
    Boolean(counterparty.mobileNumber);

  const onRequestContactReveal = async () => {
    try {
      await requestContactRevealMutation.mutateAsync({
        requestId: request.id,
        payload: {},
      });
      await dialog.alert(
        "Contact Reveal Request Sent",
        "Your request has been sent to the other party. Once approved, both of you will be able to view each other's contact details.",
      );
    } catch (error) {
      await dialog.alert("Request failed", toRequestErrorMessage(error));
    }
  };


  const onRespondContactReveal = async (approve: boolean) => {
    const revealRequestId = revealState?.incomingRequestId;
    if (!revealRequestId) {
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
      setGeneratedOtp(result.otp);
      setTxFeedback(
        `OTP generated. Expires at ${new Date(result.expiresAt).toLocaleTimeString()}.`,
      );
    } catch (error) {
      setTxFeedback(toTransactionErrorMessage(error));
    }
  };

  const onVerifyOtp = async () => {
    if (!tx) return;
    setTxFeedback(null);

    try {
      await verifyOtpMutation.mutateAsync({ transactionId: tx.id, otp: otpInput.trim() });
      setOtpInput("");
      setGeneratedOtp(null);
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={
              requestQuery.isRefetching ||
              offersQuery.isRefetching ||
              transactionQuery.isRefetching
            }
            onRefresh={() => {
              void Promise.all([
                requestQuery.refetch(),
                offersQuery.refetch(),
                shouldCheckActiveTransaction ? transactionQuery.refetch() : Promise.resolve(),
              ]);
            }}
          />
        }
      >
        {/* Top Back Button */}
        <View style={styles.topBackButtonRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.topBackButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="arrow-left" size={18} color={theme.colors.textPrimary} />
              <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600", marginLeft: 4 }}>Back</Text>
            </View>
          </Pressable>
        </View>
        {/* Request Header */}
        <View style={[styles.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={3}>{request.product.title}</Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: getStatusBadgeStyle(displayStatus).bg,
                  borderWidth: displayStatus === "CANCELLED" ? 1 : 0,
                  borderColor: displayStatus === "CANCELLED" ? "#111827" : "transparent",
                },
              ]}
            > 
              <Text style={[styles.badgeText, { color: getStatusBadgeStyle(displayStatus).text }]}> 
                {displayStatus}
              </Text>
            </View>
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
        </View>

        {/* Request Details */}
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

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Turn</Text>
            <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
              {request.currentTurn === actorTurn ? "Your turn" : "Their turn"}
            </Text>
          </View>

          {latestActiveOffer && latestActiveOffer.type !== "NONE" && (
            <>
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Latest Offer</Text>
                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                  {latestActiveOffer.type === "MIXED" ? "Product + money" : latestActiveOffer.type === "PRODUCT" ? "Product swap" : latestActiveOffer.type === "MONEY" ? "Money offer" : latestActiveOffer.type}
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
          )}

          {request.message && (
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
          )}
        </View>

        {hasConsiderationProducts ? (() => {
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
                <>
                  <Pressable
                    onPress={() => setExpandYourProducts((current) => !current)}
                    style={[
                      styles.offerHistoryHeader,
                      {
                        marginTop: 4,
                        paddingVertical: 6,
                        paddingHorizontal: 2,
                      },
                    ]}
                  >
                    <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 }]}> 
                      Yours ({activeProducts.length})
                    </Text>
                    <Feather
                      name={expandYourProducts ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                  <SmoothCollapse expanded={expandYourProducts} maxHeight={460}>
                    {activeProducts.length > 2 ? (
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
                  </SmoothCollapse>
                </>
              ) : showingRequesterProducts ? (
                <>
                  <Pressable
                    onPress={() => setExpandRequesterProducts((current) => !current)}
                    style={[
                      styles.offerHistoryHeader,
                      {
                        marginTop: 4,
                        paddingVertical: 6,
                        paddingHorizontal: 2,
                      },
                    ]}
                  >
                    <Text style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 }]}>
                      Requester's Products ({activeProducts.length})
                    </Text>
                    <Feather
                      name={expandRequesterProducts ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                  <SmoothCollapse expanded={expandRequesterProducts} maxHeight={460}>
                    {activeProducts.length > 2 ? (
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
                  </SmoothCollapse>
                </>
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
                <Button
                  label="Request Contact Details Reveal"
                  onPress={() => {
                    void (async () => {
                      const shouldRequest = await dialog.confirm(
                        "Request Contact Reveal",
                        "Send a contact reveal request to the other party? Once they approve, both of you will be able to see each other's contact details.",
                        {
                          confirmLabel: "Send Request",
                          cancelLabel: "Cancel",
                        },
                      );

                      if (shouldRequest) {
                        void onRequestContactReveal();
                      }
                    })();
                  }}
                  loading={requestContactRevealMutation.isPending}
                />
              ) : null}

              {revealState?.canApproveIncoming && revealState.incomingRequestId ? (
                <View style={styles.contactApproveRow}>
                  <Text style={[styles.feedbackText, { color: theme.colors.textMuted, marginBottom: 4 }]}>
                    The other party has requested to reveal contact details. Once approved, both of you will be able to view each other's contact information.
                  </Text>
                  <Button
                    label="Approve Reveal"
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

            {isBuyer ? (
              <>
                <Button
                  label={tx.status === "IN_PROGRESS" ? "Regenerate OTP" : "Generate OTP"}
                  onPress={onGenerateOtp}
                  loading={generateOtpMutation.isPending}
                />

                {generatedOtp ? (
                  <View style={styles.otpBox}>
                    <Text style={styles.otpLabel}>OTP: {generatedOtp}</Text>
                  </View>
                ) : null}
              </>
            ) : isSeller && tx.status === "IN_PROGRESS" ? (
              <>
                <Input
                  label="Verification OTP"
                  placeholder="Enter OTP from the other party"
                  value={otpInput}
                  onChangeText={setOtpInput}
                />

                <Button
                  label="Verify OTP & Complete"
                  onPress={onVerifyOtp}
                  loading={verifyOtpMutation.isPending}
                />
              </>
            ) : (
              <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>Waiting for the buyer to generate the OTP.</Text>
            )}

            {txFeedback && (
              <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>{txFeedback}</Text>
            )}
          </View>
        )}

        {/* Offer History */}
        {offersQuery.data?.offers && (
          <View style={{ gap: 10 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginLeft: 4 }]}>Offer History</Text>
            {historyOffers.length === 0 ? (
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No offers yet.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {historyOffers.map((offer, index) => {
                  const offeredByLabel =
                    offer.offeredById === session.user.id
                      ? "You"
                      : (offer.offeredBy?.userName || "Unknown");
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
                      title={`Offer #${historyOffers.length - index}`}
                      subtitle={`By ${offeredByLabel}`}
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
                        <View style={styles.detailRow}>
                          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Type</Text>
                          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                            {offer.type === "MIXED" ? "Product + Money" : offer.type === "PRODUCT" ? "Product swap" : offer.type === "MONEY" ? "Money offer" : offer.type}
                          </Text>
                        </View>
                      )}

                      {offer.offeredAmount && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Amount</Text>
                          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>₹{offer.offeredAmount}</Text>
                        </View>
                      )}

                      {offer.offeredProducts.length > 0 && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Offered listings</Text>
                          {offer.offeredProducts.map((op) => (
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
                          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Requested in return</Text>
                          {offer.requestedProducts.map((rp) => (
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
                })}
              </View>
            )}
          </View>
        )}

        {/* Back Button removed from bottom */}
      </ScrollView>

      <SwipeableBottomSheet
        visible={showCounterOfferForm}
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
          initialVisibleProductIds={request.visibleProducts
            .map((vp) => vp.productId)
            .filter((id) => ownOfferableProducts.some((p) => p.id === id))}
          initialRequestedProductIds={latestRequesterProductIds}
          initialAmount={latestOfferAmount}
        />
      </SwipeableBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBackButtonRow: {
    marginBottom: 2,
    marginLeft: -4,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  topBackButton: {
    paddingHorizontal: 0,
    minHeight: 32,
    minWidth: 0,
  },
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
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
  offeredProducts: { marginTop: 10, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", marginVertical: 16 },
  otpBox: {
    backgroundColor: "#dbeafe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  otpLabel: { fontSize: 14, fontWeight: "600", color: "#1e40af" },
  feedbackText: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  bottomSheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
