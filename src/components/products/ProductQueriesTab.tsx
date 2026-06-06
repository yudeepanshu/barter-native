import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ProductQuery, ProductQueryReportType } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { AppImage } from "@/components/ui/AppImage";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { QueryComposerSheet } from "./QueryComposerSheet";
import { ReportQueryModal } from "./ReportQueryModal";
import {
  useCreateProductQueryMutation,
  useReplyProductQueryMutation,
  useReportProductQueryMutation,
  toQueryErrorMessage,
} from "@/hooks/mutations/useProductQueryMutations";
import { useProductQueriesQuery } from "@/hooks/queries/useProductQueriesQuery";

interface ProductQueriesTabProps {
  productId: string;
  isOwner: boolean;
  sessionUserId?: string;
  /** Queries already embedded in the product response — used as initial data */
  initialQueries?: ProductQuery[];
  // initialNextCursor removed — unused; queriesQuery owns pagination
}

export function ProductQueriesTab({
  productId,
  isOwner,
  sessionUserId,
  initialQueries,
}: ProductQueriesTabProps) {
  const { theme } = useAppTheme();
  const dialog = useAppDialog();

  const [askSheetOpen, setAskSheetOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ProductQuery | null>(null);
  const [reportTarget, setReportTarget] = useState<ProductQuery | null>(null);

  const queriesQuery = useProductQueriesQuery(productId, { enabled: true });

  const allItems: ProductQuery[] = queriesQuery.data
    ? queriesQuery.data.pages.flatMap((p) => p.queries)
    : (initialQueries ?? []);

  const createMutation = useCreateProductQueryMutation(productId);
  const replyMutation = useReplyProductQueryMutation(productId, replyTarget?.id ?? "");
  const reportMutation = useReportProductQueryMutation(productId, reportTarget?.id ?? "");

  const handleAskSubmit = async (question: string) => {
    try {
      await createMutation.mutateAsync({ question });
    } catch (e) {
      dialog.alert("Failed", toQueryErrorMessage(e));
      throw e;
    }
  };

  const handleReplySubmit = async (content: string) => {
    try {
      await replyMutation.mutateAsync({ content });
      setReplyTarget(null);
    } catch (e) {
      dialog.alert("Failed", toQueryErrorMessage(e));
      throw e;
    }
  };

  const handleReportSubmit = (payload: {
    reportType: ProductQueryReportType;
    reason?: string;
    description?: string;
  }) => {
    if (!reportTarget) return;
    setReportTarget(null);
    dialog.alert("Report submitted", "Thank you. We'll review this query shortly.");
    reportMutation.mutate(payload, {
      onError: () => dialog.alert("Failed", "Something went wrong. Please try again."),
    });
  };

  const handleReportPress = (item: ProductQuery) => {
    if (item.isReported) {
      dialog.alert("Already reported", "This query has already been reported.");
      return;
    }
    setReportTarget(item);
  };

  const isLoadingInitial = queriesQuery.isPending && !initialQueries?.length;

  return (
    <View style={styles.wrap}>
      {!isOwner && sessionUserId ? (
        <Pressable
          style={[
            styles.askBanner,
            {
              backgroundColor: theme.mode === "dark"
                ? "rgba(99,130,255,0.10)"
                : "rgba(70,127,250,0.07)",
              borderColor: theme.mode === "dark"
                ? "rgba(99,130,255,0.28)"
                : "rgba(70,127,250,0.22)",
            },
          ]}
          onPress={() => setAskSheetOpen(true)}
        >
          <View style={styles.askBannerLeft}>
            <View
              style={[
                styles.askIconWrap,
                {
                  backgroundColor: theme.mode === "dark"
                    ? "rgba(99,130,255,0.18)"
                    : "rgba(70,127,250,0.14)",
                },
              ]}
            >
              <Feather
                name="message-circle"
                size={16}
                color={theme.mode === "dark" ? "#8bbaf3" : "#467ffa"}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[
                  styles.askBannerTitle,
                  { color: theme.mode === "dark" ? "#8bbaf3" : "#467ffa" },
                ]}
              >
                Have a query about this listing?
              </Text>
              <Text style={[styles.askBannerSub, { color: theme.colors.textMuted }]}>
                Ask the seller. Your query will be visible to all viewers.
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}

      {isLoadingInitial ? (
        <View style={styles.loadingWrap}>
          <Spinner size={20} />
        </View>
      ) : null}

      {!isLoadingInitial && allItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="message-circle" size={26} color={theme.colors.textMuted} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            No queries yet.
          </Text>
          {!isOwner && sessionUserId ? (
            <Text style={[styles.emptySubText, { color: theme.colors.textMuted }]}>
              Be the first to ask! The seller will see your query and can reply to it.
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isLoadingInitial && allItems.length > 0 ? (
        <View style={styles.list}>
          {allItems.map((item) => (
            <QueryItem
              key={item.id}
              item={item}
              isOwner={isOwner}
              sessionUserId={sessionUserId}
              onReply={() => setReplyTarget(item)}
              onReport={() => handleReportPress(item)}
            />
          ))}
        </View>
      ) : null}

      {queriesQuery.hasNextPage ? (
        <Button
          label={queriesQuery.isFetchingNextPage ? "Loading..." : "Load more"}
          variant="ghost"
          onPress={() => void queriesQuery.fetchNextPage()}
          disabled={queriesQuery.isFetchingNextPage}
        />
      ) : null}

      <QueryComposerSheet
        visible={askSheetOpen}
        onClose={() => setAskSheetOpen(false)}
        mode="ask"
        onSubmit={handleAskSubmit}
        isSubmitting={createMutation.isPending}
      />
      <QueryComposerSheet
        visible={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        mode="reply"
        onSubmit={handleReplySubmit}
        isSubmitting={replyMutation.isPending}
      />
      <ReportQueryModal
        visible={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
        isSubmitting={reportMutation.isPending}
      />
    </View>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

interface UserAvatarProps {
  uri?: string | null;
  userName: string;
  size: "md" | "sm";
  primaryColor: string;
  surfaceMutedColor: string;
}

function UserAvatar({ uri, userName, size, primaryColor, surfaceMutedColor }: UserAvatarProps) {
  const isSm = size === "sm";
  const dim = isSm ? 22 : 28;
  const radius = dim / 2;
  const fontSize = isSm ? 9 : 11;

  if (uri) {
    return (
      <AppImage
        uri={uri}
        style={[
          { width: dim, height: dim, borderRadius: radius },
          { backgroundColor: surfaceMutedColor },
        ]}
      />
    );
  }

  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        backgroundColor: surfaceMutedColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize, fontWeight: "700", color: primaryColor }}>
        {userName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

// ── QueryItem ──────────────────────────────────────────────────────────────────

function QueryItem({
  item,
  isOwner,
  sessionUserId,
  onReply,
  onReport,
}: {
  item: ProductQuery;
  isOwner: boolean;
  sessionUserId?: string;
  onReply: () => void;
  onReport: () => void;
}) {
  const { theme } = useAppTheme();
  const isDark = theme.mode === "dark";

  const isMyQuery = item.querier.id === sessionUserId;
  const isMyResponse = item.response?.responder.id === sessionUserId;
  const canReply = isOwner && !item.response && item.status === "OPEN" && !item.isReported;
  const canReport = !isMyQuery && !item.isReported;

  return (
    <View
      style={[
        styles.queryItem,
        {
          backgroundColor: theme.colors.surface,
          borderColor: item.isReported
            ? isDark ? "#991b1b" : "#fca5a5"
            : theme.colors.border,
        },
      ]}
    >
      {/* Question */}
      <View style={styles.queryHeader}>
        <View style={styles.querierRow}>
          <UserAvatar
            uri={item.querier.profilePicture}
            userName={item.querier.userName}
            size="md"
            primaryColor={theme.colors.primary}
            surfaceMutedColor={theme.colors.surfaceMuted}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={[styles.querierName, { color: theme.colors.textPrimary }]}>
              {isMyQuery ? "You" : item.querier.userName}
            </Text>
            <Text style={[styles.queryDate, { color: theme.colors.textMuted }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>

          {canReport ? (
            <Pressable
              onPress={onReport}
              hitSlop={8}
              style={[styles.reportBtn, { borderColor: theme.colors.border }]}
            >
              <Feather name="flag" size={12} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}

          {item.isReported ? (
            <View
              style={[
                styles.reportedBadge,
                {
                  backgroundColor: isDark ? "#450a0a" : "#fef2f2",
                  borderColor: isDark ? "#991b1b" : "#fca5a5",
                },
              ]}
            >
              <Feather name="flag" size={10} color={isDark ? "#f87171" : "#b91c1c"} />
              <Text style={[styles.reportedText, { color: isDark ? "#f87171" : "#b91c1c" }]}>
                Reported
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
          {item.question}
        </Text>
      </View>

      {/* Response */}
      {item.response ? (
        <View
          style={[
            styles.responseWrap,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.responseOwnerRow}>
            <UserAvatar
              uri={item.response.responder.profilePicture}
              userName={item.response.responder.userName}
              size="sm"
              primaryColor={theme.colors.primary}
              surfaceMutedColor={theme.colors.surfaceMuted}
            />
            <View style={{ gap: 1 }}>
              <View style={styles.sellerBadgeRow}>
                <Text style={[styles.responseOwnerName, { color: theme.colors.textPrimary }]}>
                  {isMyResponse ? "You" : item.response.responder.userName}
                </Text>
                <View
                  style={[
                    styles.sellerBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(99,130,255,0.15)"
                        : "rgba(70,127,250,0.10)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sellerBadgeText,
                      { color: isDark ? "#8bbaf3" : "#467ffa" },
                    ]}
                  >
                    Seller
                  </Text>
                </View>
              </View>
              <Text style={[styles.queryDate, { color: theme.colors.textMuted }]}>
                {formatDate(item.response.createdAt)}
              </Text>
            </View>
          </View>

          <Text style={[styles.responseText, { color: theme.colors.textSecondary }]}>
            {item.response.content}
          </Text>
        </View>
      ) : null}

      {/* Reply action */}
      {canReply ? (
        <Pressable
          onPress={onReply}
          style={[
            styles.replyBtn,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <Feather name="corner-down-right" size={13} color={theme.colors.textSecondary} />
          <Text style={[styles.replyBtnText, { color: theme.colors.textSecondary }]}>
            Reply
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  loadingWrap: { alignItems: "center", paddingVertical: 20 },
  emptyWrap: { alignItems: "center", gap: 6, paddingVertical: 24 },
  emptyText: { fontSize: 14, fontWeight: "600" },
  emptySubText: { fontSize: 12, textAlign: "center", maxWidth: 240 },
  list: { gap: 10 },
  askBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  askBannerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  askIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  askBannerTitle: { fontSize: 13, fontWeight: "700" },
  askBannerSub: { fontSize: 12, lineHeight: 16 },
  queryItem: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  queryHeader: { gap: 6 },
  querierRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  querierName: { fontSize: 12, fontWeight: "700" },
  queryDate: { fontSize: 11 },
  questionText: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  reportBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reportedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reportedText: { fontSize: 10, fontWeight: "600" },
  responseWrap: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginLeft: 8,
  },
  responseOwnerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sellerBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  responseOwnerName: { fontSize: 12, fontWeight: "700" },
  sellerBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  sellerBadgeText: { fontSize: 10, fontWeight: "700" },
  responseText: { fontSize: 13, lineHeight: 19 },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  replyBtnText: { fontSize: 12, fontWeight: "600" },
});