import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RequestSummary } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useRequestDetailQuery } from "@/hooks/queries/useRequestDetailQuery";
import { useRequestOffersQuery } from "@/hooks/queries/useRequestOffersQuery";
import { useActiveTransactionQuery } from "@/hooks/queries/useActiveTransactionQuery";
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
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
import { ProductCard } from "@/components/products/ProductCard";
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppDialog } from "@/providers/AppDialogProvider";

const OPEN_STATUSES: RequestSummary["status"][] = ["PENDING", "NEGOTIATING"];

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

function getOfferStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "PENDING": return { bg: "#fef3c7", text: "#b45309" };
    case "ACCEPTED": return { bg: "#dcfce7", text: "#15803d" };
    case "REJECTED": return { bg: "#fee2e2", text: "#b91c1c" };
    case "CANCELLED": return { bg: "#f1f5f9", text: "#64748b" };
    default: return { bg: "#e2e8f0", text: "#334155" };
  }
}

export default function RequestDetailScreen() {
  const router = useRouter();
  const { theme, statusBarStyle } = useAppTheme();
  const dialog = useAppDialog();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";

  const session = useSession();
  const requestQuery = useRequestDetailQuery(requestId);
  const offersQuery = useRequestOffersQuery(requestId);
  const shouldCheckActiveTransaction =
    requestQuery.data?.status === "ACCEPTED" && requestQuery.data.product.status !== "EXCHANGED";
  const transactionQuery = useActiveTransactionQuery(
    requestId,
    shouldCheckActiveTransaction,
  );

  const acceptMutation = useAcceptRequestMutation();
  const rejectMutation = useRejectRequestMutation();
  const cancelMutation = useCancelRequestMutation();
  const requestContactRevealMutation = useRequestContactRevealMutation();
  const respondContactRevealMutation = useRespondContactRevealMutation();
  const generateOtpMutation = useGenerateTransactionOtpMutation();
  const verifyOtpMutation = useVerifyTransactionOtpMutation();

  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [txFeedback, setTxFeedback] = useState<string | null>(null);

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
        <View style={[styles.errorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Request not found</Text>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>We could not load this request.</Text>
          <View style={styles.actions}>
            <Button label="Retry" onPress={() => void requestQuery.refetch()} />
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
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

  const canActByTurn = OPEN_STATUSES.includes(request.status) && request.currentTurn === actorTurn;
  const canCancel = OPEN_STATUSES.includes(request.status);
  const activeOffer = request.offers[request.offers.length - 1];
  const tx = transactionQuery.data;
  const isRequestCompleted =
    request.status === "COMPLETED" ||
    (request.status === "ACCEPTED" && (isExchangeFinalized || (!transactionQuery.isPending && !tx)));
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
        "Request sent",
        "Contact reveal request was sent. If approved, both parties will be able to see each other's contact details.",
      );
      void requestQuery.refetch();
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
        approve ? "Reveal approved" : "Reveal rejected",
        approve
          ? "Contact info is now revealed to both parties."
          : "Reveal request was rejected.",
      );
      void requestQuery.refetch();
    } catch (error) {
      await dialog.alert("Action failed", toRequestErrorMessage(error));
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
        {/* Request Header */}
        <View style={[styles.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={3}>{request.product.title}</Text>
            <View style={[styles.badge, { backgroundColor: getStatusBadgeStyle(displayStatus).bg }]}>
              <Text style={[styles.badgeText, { color: getStatusBadgeStyle(displayStatus).text }]}>
                {displayStatus}
              </Text>
            </View>
          </View>
        </View>

        {/* Request Details */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Turn</Text>
            <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
              {request.currentTurn === actorTurn ? "Your turn" : "Their turn"}
            </Text>
          </View>

          {activeOffer && (
            <>
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Latest Offer</Text>
                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{activeOffer.type}</Text>
              </View>

              {activeOffer.offeredAmount && (
                <View style={styles.detailRow}>
                  <Text style={[styles.label, { color: theme.colors.textMuted }]}>Amount</Text>
                  <Text style={[styles.value, { color: theme.colors.textPrimary }]}>₹{activeOffer.offeredAmount}</Text>
                </View>
              )}
            </>
          )}

          {request.message && (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.colors.textMuted }]}>Message</Text>
              <Text style={[styles.value, { flex: 1, color: theme.colors.textPrimary }]}>{request.message}</Text>
            </View>
          )}
        </View>

        {/* Product Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Product</Text>
          <ProductCard
            product={request.product}
            showMeta={false}
            onPress={() => router.push(`/(app)/products/${request.product.id}`)}
          />
        </View>

        {showContactRevealSection ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Contact Info</Text>
            {!revealState?.contactVisible ? (
              <Text style={[styles.contactInfoHint, { color: theme.colors.textMuted }]}>Request approval will reveal contact details for both parties.</Text>
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
                  label="Request contact reveal (both sides)"
                  onPress={() => {
                    void (async () => {
                      const shouldRequest = await dialog.confirm(
                        "Reveal contact info",
                        "Send a reveal request? If approved, contact details will be visible to both parties.",
                        {
                          confirmLabel: "Request",
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
                  <Button
                    label="Approve reveal"
                    onPress={() => void onRespondContactReveal(true)}
                    loading={respondContactRevealMutation.isPending}
                  />
                  <Button
                    label="Reject reveal"
                    variant="ghost"
                    onPress={() => void onRespondContactReveal(false)}
                    loading={respondContactRevealMutation.isPending}
                  />
                </View>
              ) : null}
            </View>

            {revealState?.viewerRequestStatus === "PENDING" ? (
              <View style={styles.revealInfoRow}>
                <Feather name="eye" size={14} color={theme.colors.textMuted} />
                <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>Reveal request pending approval. Approval reveals contact details to both parties.</Text>
              </View>
            ) : null}

            {revealState?.viewerRequestStatus === "REJECTED" ? (
              <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>Your reveal request was rejected.</Text>
            ) : null}
          </View>
        ) : null}

        {/* Action Buttons */}
        {(canActByTurn || canCancel) && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Actions</Text>
            {canActByTurn && (
              <>
                <Button
                  label="Accept"
                  onPress={() =>
                    acceptMutation.mutateAsync(request.id).catch((error) => {
                      void dialog.alert("Error", toRequestErrorMessage(error));
                    })
                  }
                  loading={acceptMutation.isPending}
                />
                <Button
                  label="Reject"
                  variant="ghost"
                  onPress={() =>
                    rejectMutation.mutateAsync(request.id).catch((error) => {
                      void dialog.alert("Error", toRequestErrorMessage(error));
                    })
                  }
                  loading={rejectMutation.isPending}
                />
              </>
            )}
            {canCancel && (
              <Button
                label="Cancel Request"
                variant="ghost"
                onPress={() =>
                  cancelMutation
                    .mutateAsync({ requestId: request.id, reason: "Cancelled from app" })
                    .catch((error) => {
                      void dialog.alert("Error", toRequestErrorMessage(error));
                    })
                }
                loading={cancelMutation.isPending}
              />
            )}
          </View>
        )}

        {/* Offer History */}
        {offersQuery.data?.offers && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Offer History</Text>
            {offersQuery.data.offers.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No offers yet.</Text>
            ) : (
              <View style={styles.offersList}>
                {offersQuery.data.offers.map((offer, index) => (
                  <View key={offer.id} style={[styles.offerCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                    <View style={styles.offerHeader}>
                      <View>
                        <Text style={[styles.offerBy, { color: theme.colors.textMuted }]}>
                          Offer #{index + 1}
                        </Text>
                        <Text style={[styles.offerBy, { color: theme.colors.textMuted }]}>By: {offer.offeredBy?.userName || "Unknown"}</Text>
                      </View>
                      <View
                        style={[
                          styles.offerStatus,
                          { backgroundColor: getOfferStatusBadgeStyle(offer.status).bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.offerStatusText,
                            { color: getOfferStatusBadgeStyle(offer.status).text },
                          ]}
                        >
                          {offer.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.offerType, { color: theme.colors.textPrimary }]}>Type: {offer.type}</Text>

                    {offer.offeredAmount && (
                      <Text style={[styles.offerAmount, { color: theme.colors.textPrimary }]}>Amount: ₹{offer.offeredAmount}</Text>
                    )}

                    {offer.offeredProducts.length > 0 && (
                      <View style={styles.offeredProducts}>
                        {offer.offeredProducts.map((op) => (
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
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

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

        {/* Back Button */}
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  label: { fontSize: 12, fontWeight: "600" },
  value: { fontSize: 14, fontWeight: "500" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
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
  feedbackText: { fontSize: 13, marginTop: 8 },
});
