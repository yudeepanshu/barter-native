import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { RequestStatus, RequestSummary, RequestTurn } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatTimeAgo, getOfferTypeLabel } from "@/lib/utils/commonUtils";
import { formatCurrency } from "@/lib/currency";
import { AppImage } from "@/components/ui/AppImage";

// ── Constants ──────────────────────────────────────────────────────────────────

const OPEN_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING"];

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "PENDING":     return { bg: "#fef3c7", text: "#b45309" };
    case "NEGOTIATING": return { bg: "#dbeafe", text: "#1d4ed8" };
    case "ACCEPTED":    return { bg: "#dcfce7", text: "#15803d" };
    case "REJECTED":    return { bg: "#fee2e2", text: "#b91c1c" };
    case "CANCELLED":   return { bg: "#f1f5f9", text: "#111827" };
    case "COMPLETED":   return { bg: "#ccfbf1", text: "#0f766e" };
    default:            return { bg: "#e2e8f0", text: "#334155" };
  }
}

export function getStatusLabel(status: RequestStatus): string {
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

// ── Props ──────────────────────────────────────────────────────────────────────

export type RequestItemProps = {
  item: RequestSummary;
  router: ReturnType<typeof useRouter>;
  actorTurn: RequestTurn;
  sessionUserId: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

export const RequestItem = memo(function RequestItem({
  item,
  router,
  actorTurn,
  sessionUserId,
}: RequestItemProps) {
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
  const hasOffer = activeOffer?.type && activeOffer.type !== "NONE";
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
            borderColor:
              theme.mode === "dark"
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.10)",
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}
      >
        {/* ── Top row: avatar · name/time · badge+turn column ── */}
        <View style={styles.itemTopRow}>
          <View
            style={[
              styles.itemAvatar,
              { backgroundColor: theme.colors.surface ?? "#e0e7ff" },
            ]}
          >
            <Text style={[styles.itemAvatarText, { color: theme.colors.primary }]}>
              {initials}
            </Text>
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
            <View
              style={[
                styles.badgeWrap,
                {
                  backgroundColor: getStatusBadgeStyle(displayStatus).bg,
                  borderWidth: displayStatus === "CANCELLED" ? 1 : 0,
                  borderColor:
                    displayStatus === "CANCELLED"
                      ? theme.colors.border
                      : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: getStatusBadgeStyle(displayStatus).text },
                ]}
                numberOfLines={1}
              >
                {getStatusLabel(displayStatus)}
              </Text>
            </View>

            {showTurn && (
              <Text
                style={[
                  styles.itemTurnText,
                  {
                    color: isMyTurn ? "#16a34a" : theme.colors.textSecondary,
                  },
                ]}
              >
                {isMyTurn ? "Your turn" : "Their turn"}
              </Text>
            )}
          </View>
        </View>

        {/* ── Bottom block: offer row only ── */}
        {hasOffer && (
          <View
            style={[
              styles.itemBottomBlock,
              { borderTopColor: theme.colors.border },
            ]}
          >
            <View style={styles.itemOfferInline}>
              <Text
                style={[styles.detailLabel, { color: theme.colors.textMuted }]}
              >
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
                    style={[
                      styles.detailValue,
                      { color: theme.colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {offerLabel === "CASH + TRADE" ? "TRADE" : offerLabel}
                  </Text>
                )}
                {isTrade && offerAmount != null && (
                  <Feather
                    name="plus"
                    size={11}
                    color={theme.colors.textMuted}
                  />
                )}
                {offerAmount != null && (
                  <Text
                    style={[
                      styles.detailValue,
                      { color: theme.colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {offerAmount}
                  </Text>
                )}
              </View>
              <Feather
                name="chevron-right"
                size={14}
                color={theme.colors.textMuted}
              />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
});

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  itemCardPressable: {
    opacity: 1,
  },
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
    borderWidth: 1.5,
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
  productGroupThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    flexShrink: 0,
  },
});