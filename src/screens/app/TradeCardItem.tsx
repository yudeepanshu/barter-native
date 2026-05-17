import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { RequestSummary, RequestTurn } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatTimeAgo } from "@/lib/utils/commonUtils";
import { getStatusBadgeStyle, getStatusLabel } from "./RequestItem";
import { AppImage } from "@/components/ui/AppImage";

// ── Constants ──────────────────────────────────────────────────────────────────
 
const IMAGE_SIZE = 44; // same visual weight as the 30px avatar but square
 
// ── Types ──────────────────────────────────────────────────────────────────────
 
export type TradeCardItemProps = {
  item: RequestSummary;
  router: ReturnType<typeof useRouter>;
  actorTurn: RequestTurn;
  sessionUserId: string;
  showTurnLabel?: boolean;
};
 
// ── Component ──────────────────────────────────────────────────────────────────
 
export const TradeCardItem = memo(function TradeCardItem({
  item,
  router,
}: TradeCardItemProps) {
  const { theme } = useAppTheme();
 
  const isExchangeFinalized = item.product?.status === "EXCHANGED";
  const isRequestCompleted =
    item.status === "COMPLETED" ||
    (item.status === "ACCEPTED" && isExchangeFinalized);
  const displayStatus: RequestSummary["status"] = isRequestCompleted
    ? "COMPLETED"
    : item.status;
 
  const productTitle = item.product?.title?.trim() || "Untitled Product";
  const firstImage = item.product?.productImages?.[0];
  const imageUri =
    typeof firstImage === "string"
      ? firstImage
      : (firstImage as { uri?: string; url?: string } | undefined)?.uri ??
        (firstImage as { uri?: string; url?: string } | undefined)?.url ??
        null;
 
  const timeLabel = formatTimeAgo(item.updatedAt ?? item.createdAt);
  const badgeStyle = getStatusBadgeStyle(displayStatus);
 
  return (
    <Pressable
      style={styles.pressable}
      onPress={() => router.push(`/(app)/requests/${item.id}`)}
    >
      <View
        style={[
          styles.card,
          {
            borderColor:
              theme.mode === "dark"
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.10)",
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}
      >
        {/* ── Left: fixed-size square product thumbnail ── */}
        {imageUri ? (
          <AppImage
            uri={imageUri}
            recyclingKey={`trade-thumb-${item.id}`}
            style={styles.productImage}
          />
        ) : (
          <View
            style={[
              styles.productImage,
              styles.productImageFallback,
              { backgroundColor: theme.colors.surface ?? "#e0e7ff" },
            ]}
          >
            <Text style={[styles.fallbackText, { color: theme.colors.textMuted }]}>
              {productTitle.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
 
        {/* ── Middle: title + time ── */}
        <View style={styles.contentCol}>
          <Text
            style={[styles.productTitle, { color: theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {productTitle}
          </Text>
          <Text
            style={[styles.timeText, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {timeLabel}
          </Text>
        </View>
 
        {/* ── Right: badge — centered by card's alignItems: "center" ── */}
        <View
          style={[
            styles.badgeWrap,
            {
              backgroundColor: badgeStyle.bg,
              borderWidth: displayStatus === "CANCELLED" ? 1 : 0,
              borderColor:
                displayStatus === "CANCELLED"
                  ? theme.colors.border
                  : "transparent",
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
            {getStatusLabel(displayStatus)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
 
// ── Styles ─────────────────────────────────────────────────────────────────────
 
const styles = StyleSheet.create({
  pressable: {
    opacity: 1,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  productImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    flexShrink: 0,
  },
  productImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 14,
    fontWeight: "700",
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: "center",
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "400",
    flexShrink: 1,
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
 