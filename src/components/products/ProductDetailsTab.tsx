import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ProductSummary } from "@barter/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppDialog } from "@/providers/AppDialogProvider";
import {
  ProductQuestionsModal,
  type ProductQuestionsPayload,
  type ProductQuestionKey,
} from "./ProductQuestionsModal";
import { useUpdateProductQuestionsMutation } from "@/hooks/mutations/useUpdateProductQuestionsMutation";
import { Spinner } from "../ui/Spinner";

// ── Meta for rendering ─────────────────────────────────────────────────────────

const QUESTION_META: Array<{
  key: ProductQuestionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}> = [
  { key: "purchaseDate", label: "Purchase Date", icon: "calendar" },
  { key: "hasBill", label: "Original Bill", icon: "file-text" },
  { key: "condition", label: "Condition", icon: "activity" },
  { key: "warrantyStatus", label: "Warranty", icon: "shield" },
  { key: "reasonForSale", label: "Reason for Sale", icon: "tag" },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface ProductDetailsTabProps {
  product: ProductSummary;
  isOwner: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProductDetailsTab({ product, isOwner, isLoading }: ProductDetailsTabProps & { isLoading?: boolean }) {
  const { theme } = useAppTheme();
  const dialog = useAppDialog();
  const [modalVisible, setModalVisible] = useState(false);

  const updateMutation = useUpdateProductQuestionsMutation(product.id);

  const questions = product.optionalQuestions ?? {};
  const answeredMeta = QUESTION_META.filter((m) => questions[m.key]);
  const hasAny = answeredMeta.length > 0;

  const initialValues = Object.fromEntries(
    QUESTION_META.map((m) => [m.key, questions[m.key] ?? ""]),
  ) as ProductQuestionsPayload;

  const handleSubmit = (payload: ProductQuestionsPayload) => {
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setModalVisible(false);
        dialog.alert("Saved", "Your listing details have been updated.");
      },
      onError: () => {
        dialog.alert("Failed", "Something went wrong. Please try again.");
      },
    });
  };

    if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <Spinner size={20} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {hasAny ? (
        <>
          {/* ── Details table ──────────────────────────────────────────────── */}
          <View
            style={[
              styles.card,
              {
                borderColor: theme.colors.border,
                backgroundColor:
                  theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              },
            ]}
          >
            {answeredMeta.map((meta, i) => (
              <View key={meta.key}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: theme.colors.surfaceMuted },
                    ]}
                  >
                    <Feather name={meta.icon} size={13} color={theme.colors.textMuted} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: theme.colors.textMuted }]}>
                      {meta.label}
                    </Text>
                    <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]}>
                      {questions[meta.key]}
                    </Text>
                  </View>
                </View>
                {i < answeredMeta.length - 1 ? (
                  <View
                    style={[styles.divider, { backgroundColor: theme.colors.border }]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          {/* ── Edit button for owner ───────────────────────────────────────── */}
          {isOwner ? (
            <Pressable
              onPress={() => setModalVisible(true)}
              style={[
                styles.editBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            >
              <Feather name="edit-2" size={13} color={theme.colors.textSecondary} />
              <Text style={[styles.editBtnText, { color: theme.colors.textSecondary }]}>
                Edit details
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        /* ── Empty state ─────────────────────────────────────────────────────── */
        <View style={styles.emptyWrap}>
          <Feather name="info" size={26} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textMuted }]}>
            No details added
          </Text>
          {isOwner ? (
            <>
              <Text style={[styles.emptySubText, { color: theme.colors.textMuted }]}>
                Add details like purchase date, condition, and warranty to help buyers
                make faster decisions.
              </Text>
              <Pressable
                onPress={() => setModalVisible(true)}
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              >
                <Feather name="plus" size={14} color={theme.colors.onPrimary} />
                <Text style={[styles.addBtnText, { color: theme.colors.onPrimary }]}>
                    Add details
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.emptySubText, { color: theme.colors.textMuted }]}>
              The seller hasn't added additional details for this listing yet.
            </Text>
          )}
        </View>
      )}

      <ProductQuestionsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
        isSubmitting={updateMutation.isPending}
        initialValues={initialValues}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rowValue: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  divider: { height: 1, marginLeft: 50 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editBtnText: { fontSize: 12, fontWeight: "600" },
  emptyWrap: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyTitle: { fontSize: 14, fontWeight: "600" },
  emptySubText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 260,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  loadingWrap: { alignItems: "center", paddingVertical: 20 },
});