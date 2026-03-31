import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { ProductSummary, RequestStatus, RequestSummary, RequestTurn } from "@barter/types";
import { StatusBar } from "expo-status-bar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useCreateCounterOfferMutation,
  useRequestContactRevealMutation,
  useRespondContactRevealMutation,
  useRejectRequestMutation,
  toErrorMessage as toRequestErrorMessage,
} from "@/hooks/mutations/useRequestMutations";
import {
  useGenerateTransactionOtpMutation,
  useVerifyTransactionOtpMutation,
  toErrorMessage as toTransactionErrorMessage,
} from "@/hooks/mutations/useTransactionMutations";
import { useActiveTransactionQuery } from "@/hooks/queries/useActiveTransactionQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useSession } from "@/hooks/useSession";
import { useAppTheme } from "@/hooks/useAppTheme";

const OPEN_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING"];

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
  const requestContactRevealMutation = useRequestContactRevealMutation();
  const respondContactRevealMutation = useRespondContactRevealMutation();

  const sentItems = sentQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const receivedItems = receivedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const ownOfferableProducts = ownProducts.items;
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [hasAutoSelectedTab, setHasAutoSelectedTab] = useState(false);

  const tabOptions = useMemo(
    () => [
      { value: "received" as const, label: `Received (${receivedItems.length})` },
      { value: "sent" as const, label: `Sent (${sentItems.length})` },
    ],
    [receivedItems.length, sentItems.length],
  );

  useEffect(() => {
    if (hasAutoSelectedTab || receivedQuery.isPending || sentQuery.isPending) {
      return;
    }

    if (receivedItems.length > 0) {
      setActiveTab("received");
    } else if (sentItems.length > 0) {
      setActiveTab("sent");
    }

    setHasAutoSelectedTab(true);
  }, [
    hasAutoSelectedTab,
    receivedQuery.isPending,
    sentQuery.isPending,
    receivedItems.length,
    sentItems.length,
  ]);

  const isEverythingEmpty =
    !sentQuery.isPending &&
    !receivedQuery.isPending &&
    !sentQuery.error &&
    !receivedQuery.error &&
    sentItems.length === 0 &&
    receivedItems.length === 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={
              sentQuery.isRefetching || receivedQuery.isRefetching || ownProducts.query.isRefetching
            }
            onRefresh={() => {
              void Promise.all([
                sentQuery.refetch(),
                receivedQuery.refetch(),
                ownProducts.query.refetch(),
              ]);
            }}
          />
        }
      >
        <View style={styles.headerCard}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Requests</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Manage incoming and outgoing negotiations.</Text>
        </View>

        <View style={[styles.tabsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SegmentedControl
            value={activeTab}
            options={tabOptions}
            onChange={setActiveTab}
          />
        </View>

        {isEverythingEmpty ? (
          <View style={[styles.emptyCardGlobal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Feather name="inbox" size={20} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No requests right now</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>Once someone sends or receives an offer, it will appear here.</Text>
          </View>
        ) : null}

        {activeTab === "received" ? (
          <RequestSection
            title="Received"
            actorTurn="SELLER"
            router={router}
            items={receivedItems}
            isPending={receivedQuery.isPending}
            isError={Boolean(receivedQuery.error)}
            onRetry={() => void receivedQuery.refetch()}
            hasNextPage={Boolean(receivedQuery.hasNextPage)}
            loadingNext={receivedQuery.isFetchingNextPage}
            onLoadMore={() => void receivedQuery.fetchNextPage()}
            acceptMutation={acceptMutation}
            rejectMutation={rejectMutation}
            cancelMutation={cancelMutation}
            counterOfferMutation={counterOfferMutation}
            requestContactRevealMutation={requestContactRevealMutation}
            respondContactRevealMutation={respondContactRevealMutation}
            sessionUserId={session?.user.id ?? ""}
            ownOfferableProducts={ownOfferableProducts}
          />
        ) : (
          <RequestSection
            title="Sent"
            actorTurn="BUYER"
            router={router}
            items={sentItems}
            isPending={sentQuery.isPending}
            isError={Boolean(sentQuery.error)}
            onRetry={() => void sentQuery.refetch()}
            hasNextPage={Boolean(sentQuery.hasNextPage)}
            loadingNext={sentQuery.isFetchingNextPage}
            onLoadMore={() => void sentQuery.fetchNextPage()}
            acceptMutation={acceptMutation}
            rejectMutation={rejectMutation}
            cancelMutation={cancelMutation}
            counterOfferMutation={counterOfferMutation}
            requestContactRevealMutation={requestContactRevealMutation}
            respondContactRevealMutation={respondContactRevealMutation}
            sessionUserId={session?.user.id ?? ""}
            ownOfferableProducts={ownOfferableProducts}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RequestSection({
  title,
  actorTurn,
  router,
  items,
  isPending,
  isError,
  onRetry,
  hasNextPage,
  loadingNext,
  onLoadMore,
  acceptMutation,
  rejectMutation,
  cancelMutation,
  counterOfferMutation,
  requestContactRevealMutation,
  respondContactRevealMutation,
  sessionUserId,
  ownOfferableProducts,
}: {
  title: string;
  actorTurn: RequestTurn;
  router: ReturnType<typeof useRouter>;
  items: RequestSummary[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasNextPage: boolean;
  loadingNext: boolean;
  onLoadMore: () => void;
  acceptMutation: ReturnType<typeof useAcceptRequestMutation>;
  rejectMutation: ReturnType<typeof useRejectRequestMutation>;
  cancelMutation: ReturnType<typeof useCancelRequestMutation>;
  counterOfferMutation: ReturnType<typeof useCreateCounterOfferMutation>;
  requestContactRevealMutation: ReturnType<typeof useRequestContactRevealMutation>;
  respondContactRevealMutation: ReturnType<typeof useRespondContactRevealMutation>;
  sessionUserId: string;
  ownOfferableProducts: ProductSummary[];
}) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>{title}</Text>

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

      {!isPending && !isError && items.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No requests yet.</Text>
        </View>
      ) : null}

      {!isPending && !isError && items.length > 0 ? (
        <View style={styles.listWrap}>
          {items.map((item) => (
            <RequestItem
              key={item.id}
              item={item}
              router={router}
              actorTurn={actorTurn}
              acceptMutation={acceptMutation}
              rejectMutation={rejectMutation}
              cancelMutation={cancelMutation}
              counterOfferMutation={counterOfferMutation}
              requestContactRevealMutation={requestContactRevealMutation}
              respondContactRevealMutation={respondContactRevealMutation}
              sessionUserId={sessionUserId}
              ownOfferableProducts={ownOfferableProducts}
            />
          ))}

          {hasNextPage ? (
            <Button label="Load more" variant="ghost" loading={loadingNext} onPress={onLoadMore} />
          ) : null}
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
  requestContactRevealMutation,
  respondContactRevealMutation,
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
  requestContactRevealMutation: ReturnType<typeof useRequestContactRevealMutation>;
  respondContactRevealMutation: ReturnType<typeof useRespondContactRevealMutation>;
  sessionUserId: string;
  ownOfferableProducts: ProductSummary[];
}) {
  const { theme } = useAppTheme();
  const activeTransactionQuery = useActiveTransactionQuery(
    item.id,
    item.status === "ACCEPTED" && item.product.status !== "EXCHANGED",
  );
  const generateOtpMutation = useGenerateTransactionOtpMutation();
  const verifyOtpMutation = useVerifyTransactionOtpMutation();

  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
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
  const showTransactionSection = item.status === "ACCEPTED" && !isExchangeFinalized;
  const showContactRevealSection = item.status === "ACCEPTED" && item.product.status === "RESERVED";
  const canActByTurn = !showTransactionSection && OPEN_STATUSES.includes(item.status) && item.currentTurn === actorTurn;
  const canCancel = !showTransactionSection && OPEN_STATUSES.includes(item.status);
  const canCounter =
    !item.product.isFree &&
    (item.status === "PENDING" || item.status === "NEGOTIATING") &&
    canActByTurn;
  const isBuyer = sessionUserId === item.buyerId;
  const isSeller = sessionUserId === item.sellerId;
  const counterparty = isBuyer ? item.seller : item.buyer;
  const revealState = item.contactReveal;
  const showPhone = item.contactPreference === "PHONE" || item.contactPreference === "BOTH";
  const showEmail = item.contactPreference === "EMAIL" || item.contactPreference === "BOTH";
  const tx = activeTransactionQuery.data;
  const hasInlineInputOpen =
    showCounterForm || (isSeller && tx?.status === "IN_PROGRESS");
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

  const onGenerateOtp = () => {
    if (!tx) return;
    setTxFeedback(null);

    void generateOtpMutation
      .mutateAsync(tx.id)
      .then((result) => {
        setGeneratedOtp(result.otp);
        setTxFeedback(
          `OTP generated. Expires at ${new Date(result.expiresAt).toLocaleTimeString()}.`,
        );
      })
      .catch((error) => {
        setTxFeedback(toTransactionErrorMessage(error));
      });
  };

  const onVerifyOtp = () => {
    if (!tx) return;
    setTxFeedback(null);

    void verifyOtpMutation
      .mutateAsync({ transactionId: tx.id, otp: otpInput.trim() })
      .then(() => {
        setOtpInput("");
        setGeneratedOtp(null);
        setTxFeedback("OTP verified. Transaction completed.");
      })
      .catch((error) => {
        setTxFeedback(toTransactionErrorMessage(error));
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

  const onRequestContactReveal = () => {
    Alert.alert("Reveal contact info", "Send a reveal request to the other party?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Request",
        onPress: () => {
          void requestContactRevealMutation
            .mutateAsync({ requestId: item.id, payload: {} })
            .catch((error) => {
              setTxFeedback(toRequestErrorMessage(error));
            });
        },
      },
    ]);
  };

  const onRespondContactReveal = (approve: boolean) => {
    if (!revealState?.incomingRequestId) {
      return;
    }

    void respondContactRevealMutation
      .mutateAsync({
        requestId: item.id,
        revealRequestId: revealState.incomingRequestId,
        payload: { approve },
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
        <View style={styles.itemHeader}>
          <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
            {item.product.title}
          </Text>
          <View style={[styles.badgeWrap, { backgroundColor: getStatusBadgeStyle(item.status).bg }]}>
            <Text style={[styles.badgeText, { color: getStatusBadgeStyle(item.status).text }]} numberOfLines={1}>
              {item.status}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaPill, { color: theme.colors.textMuted }]}>
            {item.currentTurn === actorTurn ? "Your turn" : "Their turn"}
          </Text>
          <Text style={[styles.metaDot, { color: theme.colors.textMuted }]}>·</Text>
          <Text style={[styles.metaPill, { color: theme.colors.textMuted }]}>{activeOffer?.type ?? "NONE"}</Text>
          {activeOffer?.offeredAmount != null ? (
            <>
              <Text style={[styles.metaDot, { color: theme.colors.textMuted }]}>·</Text>
              <Text style={[styles.metaPill, { color: theme.colors.textMuted }]}>₹{activeOffer.offeredAmount}</Text>
            </>
          ) : null}
        </View>
        {item.message ? <Text style={[styles.messageText, { color: theme.colors.textSecondary }]}>{item.message}</Text> : null}

        {showContactRevealSection ? (
          <>
            <View style={[styles.contactCardRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              {showPhone ? (
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Phone: {counterparty.mobileNumber ?? "Not available"}</Text>
              ) : null}
              {showEmail ? (
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Email: {counterparty.email ?? "Not available"}</Text>
              ) : null}
              {revealState?.canRequestReveal ? (
                <Pressable
                  style={[styles.eyeButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                  onPress={onRequestContactReveal}
                >
                  <Feather name="eye" size={14} color={theme.colors.textPrimary} />
                </Pressable>
              ) : null}
            </View>

            {revealState?.canApproveIncoming && revealState.incomingRequestId ? (
              <View style={styles.actionRowSecondary}>
                <View style={styles.actionSecondaryCell}>
                  <Button
                    label="Approve reveal"
                    onPress={() => onRespondContactReveal(true)}
                    loading={respondContactRevealMutation.isPending}
                  />
                </View>
                <View style={styles.actionSecondaryCell}>
                  <Button
                    label="Reject reveal"
                    variant="ghost"
                    onPress={() => onRespondContactReveal(false)}
                    loading={respondContactRevealMutation.isPending}
                  />
                </View>
              </View>
            ) : null}

            {revealState?.viewerRequestStatus === "PENDING" ? (
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Contact reveal request pending.</Text>
            ) : null}

            {revealState?.viewerRequestStatus === "REJECTED" ? (
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Your reveal request was rejected.</Text>
            ) : null}
          </>
        ) : null}

        <View style={styles.actions}>
          {canActByTurn ? (
            <View style={styles.actionRow}>
              <View style={styles.actionCell}>
                <Button label="Accept" loading={acceptMutation.isPending} onPress={onAccept} />
              </View>
              <View style={styles.actionCell}>
                <Button
                  label="Decline offer"
                  variant="ghost"
                  loading={rejectMutation.isPending}
                  onPress={onReject}
                />
              </View>
            </View>
          ) : null}

          {canCounter ? (
            <View style={styles.actionRowSecondary}>
              <View style={styles.actionSecondaryCell}>
                <Button
                  label={showCounterForm ? "Hide counter" : "Counter offer"}
                  variant="ghost"
                  onPress={() => setShowCounterForm((prev) => !prev)}
                />
              </View>
            </View>
          ) : null}

          {canCancel ? (
            <View style={styles.actionRowTertiary}>
              <View style={styles.actionSecondaryCell}>
                <Button
                  label="Cancel request"
                  variant="ghost"
                  loading={cancelMutation.isPending}
                  onPress={onCancel}
                />
              </View>
            </View>
          ) : null}
        </View>

      {showCounterForm && canCounter ? (
        <View style={[styles.counterCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          <Text style={[styles.transactionTitle, { color: theme.colors.textPrimary }]}>Create Counter Offer</Text>

          {!item.product.isFree ? (
            <View style={styles.modeRow}>
              {item.product.requestByMoney ? (
                <>
                  <Button
                    label="MONEY"
                    variant={counterOfferType === "MONEY" ? "primary" : "ghost"}
                    onPress={() => setCounterOfferType("MONEY")}
                  />
                  <Button
                    label="PRODUCT"
                    variant={counterOfferType === "PRODUCT" ? "primary" : "ghost"}
                    onPress={() => setCounterOfferType("PRODUCT")}
                  />
                  <Button
                    label="MIXED"
                    variant={counterOfferType === "MIXED" ? "primary" : "ghost"}
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

      {showTransactionSection ? (
        <View style={[styles.transactionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          <Text style={[styles.transactionTitle, { color: theme.colors.textPrimary }]}>Transaction</Text>

          {activeTransactionQuery.isPending ? (
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Checking active transaction...</Text>
          ) : null}

          {activeTransactionQuery.error ? (
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>No active transaction found for this request.</Text>
          ) : null}

          {tx ? (
            <>
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Status: {tx.status}</Text>

              {isBuyer ? (
                <Button
                  label={tx.status === "IN_PROGRESS" ? "Regenerate OTP" : "Generate OTP"}
                  loading={generateOtpMutation.isPending}
                  onPress={onGenerateOtp}
                />
              ) : null}

              {generatedOtp ? <Text style={[styles.otpText, { color: theme.colors.textPrimary }]}>OTP: {generatedOtp}</Text> : null}

              {isSeller && tx.status === "IN_PROGRESS" ? (
                <>
                  <Input
                    label="Verify OTP"
                    placeholder="6 digit code"
                    value={otpInput}
                    onChangeText={setOtpInput}
                    keyboardType="number-pad"
                  />
                  <Button
                    label="Verify OTP"
                    loading={verifyOtpMutation.isPending}
                    onPress={onVerifyOtp}
                  />
                </>
              ) : isSeller ? (
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Waiting for the buyer to generate the OTP.</Text>
              ) : null}
            </>
          ) : null}

          {txFeedback ? <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{txFeedback}</Text> : null}
        </View>
      ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardWrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 36, gap: 12 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14 },
  tabsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
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
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
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
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  itemCardPressable: {
    opacity: 1,
  },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
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
});
