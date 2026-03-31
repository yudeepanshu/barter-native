import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
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
        <View style={styles.errorCard}>
          <Text style={styles.title}>Request not found</Text>
          <Text style={styles.description}>We could not load this request.</Text>
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
  const showTransactionSection = request.status === "ACCEPTED" && !isExchangeFinalized;
  const showContactRevealSection = request.status === "ACCEPTED" && request.product.status === "RESERVED";
  const showPhone = request.contactPreference === "PHONE" || request.contactPreference === "BOTH";
  const showEmail = request.contactPreference === "EMAIL" || request.contactPreference === "BOTH";

  const canActByTurn = OPEN_STATUSES.includes(request.status) && request.currentTurn === actorTurn;
  const canCancel = OPEN_STATUSES.includes(request.status);
  const activeOffer = request.offers[request.offers.length - 1];
  const tx = transactionQuery.data;

  const onRequestContactReveal = async () => {
    try {
      await requestContactRevealMutation.mutateAsync({
        requestId: request.id,
        payload: {},
      });
      Alert.alert("Request sent", "Contact reveal request was sent to the other party.");
      void requestQuery.refetch();
    } catch (error) {
      Alert.alert("Request failed", toRequestErrorMessage(error));
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
      Alert.alert(
        approve ? "Reveal approved" : "Reveal rejected",
        approve
          ? "Contact info is now revealed to the requester."
          : "Reveal request was rejected.",
      );
      void requestQuery.refetch();
    } catch (error) {
      Alert.alert("Action failed", toRequestErrorMessage(error));
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
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={3}>{request.product.title}</Text>
            <View style={[styles.badge, { backgroundColor: getStatusBadgeStyle(request.status).bg }]}>
              <Text style={[styles.badgeText, { color: getStatusBadgeStyle(request.status).text }]}>
                {request.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Request Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Turn</Text>
            <Text style={styles.value}>
              {request.currentTurn === actorTurn ? "Your turn" : "Their turn"}
            </Text>
          </View>

          {activeOffer && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Latest Offer</Text>
                <Text style={styles.value}>{activeOffer.type}</Text>
              </View>

              {activeOffer.offeredAmount && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Amount</Text>
                  <Text style={styles.value}>₹{activeOffer.offeredAmount}</Text>
                </View>
              )}
            </>
          )}

          {request.message && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Message</Text>
              <Text style={[styles.value, { flex: 1 }]}>{request.message}</Text>
            </View>
          )}
        </View>

        {/* Product Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Product</Text>
          <ProductCard
            product={request.product}
            showMeta={false}
            onPress={() => router.push(`/(app)/products/${request.product.id}`)}
          />
        </View>

        {showContactRevealSection ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contact Info</Text>

            <View style={styles.contactRow}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{counterparty.userName}</Text>
            </View>

            {showPhone ? (
              <View style={styles.contactRow}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{counterparty.mobileNumber ?? "Not available"}</Text>
              </View>
            ) : null}

            {showEmail ? (
              <View style={styles.contactRow}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{counterparty.email ?? "Not available"}</Text>
              </View>
            ) : null}

            <View style={styles.contactActionsRow}>
              {revealState?.canRequestReveal ? (
                <Button
                  label="Request contact reveal"
                  onPress={() => {
                    Alert.alert(
                      "Reveal contact info",
                      "Send a reveal request to the other party?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Request", onPress: () => void onRequestContactReveal() },
                      ],
                    );
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
                <Feather name="eye" size={14} color="#475569" />
                <Text style={styles.feedbackText}>Reveal request pending approval.</Text>
              </View>
            ) : null}

            {revealState?.viewerRequestStatus === "REJECTED" ? (
              <Text style={styles.feedbackText}>Your reveal request was rejected.</Text>
            ) : null}
          </View>
        ) : null}

        {/* Action Buttons */}
        {(canActByTurn || canCancel) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {canActByTurn && (
              <>
                <Button
                  label="Accept"
                  onPress={() =>
                    acceptMutation.mutateAsync(request.id).catch((error) => {
                      Alert.alert("Error", toRequestErrorMessage(error));
                    })
                  }
                  loading={acceptMutation.isPending}
                />
                <Button
                  label="Reject"
                  variant="ghost"
                  onPress={() =>
                    rejectMutation.mutateAsync(request.id).catch((error) => {
                      Alert.alert("Error", toRequestErrorMessage(error));
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
                      Alert.alert("Error", toRequestErrorMessage(error));
                    })
                }
                loading={cancelMutation.isPending}
              />
            )}
          </View>
        )}

        {/* Offer History */}
        {offersQuery.data?.offers && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Offer History</Text>
            {offersQuery.data.offers.length === 0 ? (
              <Text style={styles.emptyText}>No offers yet.</Text>
            ) : (
              <View style={styles.offersList}>
                {offersQuery.data.offers.map((offer, index) => (
                  <View key={offer.id} style={styles.offerCard}>
                    <View style={styles.offerHeader}>
                      <View>
                        <Text style={styles.offerBy}>
                          Offer #{index + 1}
                        </Text>
                        <Text style={styles.offerBy}>By: {offer.offeredBy?.userName || "Unknown"}</Text>
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

                    <Text style={styles.offerType}>Type: {offer.type}</Text>

                    {offer.offeredAmount && (
                      <Text style={styles.offerAmount}>Amount: ₹{offer.offeredAmount}</Text>
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
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Finalize Exchange</Text>

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
              <Text style={styles.feedbackText}>Waiting for the buyer to generate the OTP.</Text>
            )}

            {txFeedback && (
              <Text style={styles.feedbackText}>{txFeedback}</Text>
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
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorCard: {
    margin: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  title: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: "800", color: "#0f172a" },
  description: { fontSize: 14, color: "#475569" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 10,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
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
  },
  contactActionsRow: {
    gap: 8,
    marginTop: 4,
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
  label: { fontSize: 12, fontWeight: "600", color: "#94a3b8" },
  value: { fontSize: 14, fontWeight: "500", color: "#0f172a" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  offersList: { gap: 10 },
  offerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  offerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  offerBy: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  offerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offerStatusText: { fontSize: 10, fontWeight: "600" },
  offerType: { fontSize: 13, fontWeight: "500", color: "#0f172a" },
  offerAmount: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  offeredProducts: { marginTop: 10, gap: 12 },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center", marginVertical: 16 },
  otpBox: {
    backgroundColor: "#dbeafe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  otpLabel: { fontSize: 14, fontWeight: "600", color: "#1e40af" },
  feedbackText: { fontSize: 13, color: "#64748b", marginTop: 8 },
});
