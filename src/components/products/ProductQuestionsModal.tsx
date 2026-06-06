import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FloatingModal } from "@/components/ui/FloatingModal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CustomScrollView } from "@/components/ui/CustomScrollView";

export type ProductQuestionKey =
  | "purchaseDate"
  | "hasBill"
  | "condition"
  | "warrantyStatus"
  | "reasonForSale";

export type ProductQuestionsPayload = Partial<Record<ProductQuestionKey, string>>;

interface ProductQuestionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: ProductQuestionsPayload) => void;
  isSubmitting?: boolean;
  /** Pre-fill with existing answers when editing */
  initialValues?: ProductQuestionsPayload;
}

const PILL_OPTIONS = ["Yes", "No"];

function PillSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.pillRow}>
      {PILL_OPTIONS.map((opt) => {
        const isActive = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(isActive ? "" : opt)}
            style={[
              styles.pill,
              {
                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                backgroundColor: isActive
                  ? theme.mode === "dark"
                    ? "rgba(99,130,255,0.15)"
                    : "rgba(70,127,250,0.09)"
                  : theme.colors.surfaceMuted,
              },
            ]}
          >
            <Text
              style={[
                styles.pillLabel,
                {
                  color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.fieldLabelWrap}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
      {hint ? (
        <Text style={[styles.fieldHint, { color: theme.colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function ProductQuestionsModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  initialValues = {},
}: ProductQuestionsModalProps) {
  const { theme } = useAppTheme();

  const [purchaseDate, setPurchaseDate] = useState(initialValues.purchaseDate ?? "");
  const [hasBill, setHasBill] = useState(initialValues.hasBill ?? "");
  const [condition, setCondition] = useState(initialValues.condition ?? "");
  const [warrantyStatus, setWarrantyStatus] = useState(initialValues.warrantyStatus ?? "");
  const [reasonForSale, setReasonForSale] = useState(initialValues.reasonForSale ?? "");

    const resetFields = () => {
        setPurchaseDate(initialValues.purchaseDate ?? "");
        setHasBill(initialValues.hasBill ?? "");
        setCondition(initialValues.condition ?? "");
        setWarrantyStatus(initialValues.warrantyStatus ?? "");
        setReasonForSale(initialValues.reasonForSale ?? "");
    };

    const handleClose = () => {
        resetFields();
        onClose();
    };

    const handleSubmit = () => {
        const payload: ProductQuestionsPayload = {};
        if (purchaseDate.trim()) payload.purchaseDate = purchaseDate.trim();
        if (hasBill) payload.hasBill = hasBill;
        if (condition.trim()) payload.condition = condition.trim();
        if (warrantyStatus) payload.warrantyStatus = warrantyStatus;
        if (reasonForSale.trim()) payload.reasonForSale = reasonForSale.trim();
        onSubmit(payload);
        resetFields();
    };

  const hasAnyValue =
    purchaseDate.trim() ||
    hasBill ||
    condition.trim() ||
    warrantyStatus ||
    reasonForSale.trim();

  return (
    <FloatingModal visible={visible} title="Listing Details" onClose={handleClose}>
      <CustomScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Listings with details get more serious buyers. Take 30 seconds to answer a few quick questions.
        </Text>

        {/* Purchase Date */}
        <View style={styles.field}>
          <FieldLabel
            label="When did you buy this?"
            hint="e.g. Jan 2023, about 2 years ago"
          />
          <Input
            placeholder="Enter purchase date or timeframe"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            maxLength={100}
            showCharacterCount
          />
        </View>

        {/* Has Bill */}
        <View style={styles.field}>
          <FieldLabel label="Do you have the original bill / invoice?" />
          <PillSelector value={hasBill} onChange={setHasBill} />
        </View>

        {/* Condition */}
        <View style={styles.field}>
          <FieldLabel
            label="How would you describe its condition?"
            hint="e.g. Minor scratch on back, screen is perfect"
          />
          <Input
            placeholder="Describe the condition"
            value={condition}
            onChangeText={setCondition}
            maxLength={200}
            showCharacterCount
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />
        </View>

        {/* Warranty Status */}
        <View style={styles.field}>
          <FieldLabel label="Is it still under warranty?" />
          <PillSelector value={warrantyStatus} onChange={setWarrantyStatus} />
        </View>

        {/* Reason For Sale */}
        <View style={styles.field}>
          <FieldLabel
            label="Why are you selling this?"
            hint="e.g. Upgrading, no longer needed"
          />
          <Input
            placeholder="Your reason for selling"
            value={reasonForSale}
            onChangeText={setReasonForSale}
            maxLength={200}
            showCharacterCount
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Save Details"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!hasAnyValue || isSubmitting}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            onPress={handleClose}
            disabled={isSubmitting}
          />
        </View>
      </CustomScrollView>
    </FloatingModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 560 },
  scrollContent: { gap: 20 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  field: { gap: 8 },
  fieldLabelWrap: { gap: 2 },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  fieldHint: { fontSize: 12, lineHeight: 16 },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillLabel: { fontSize: 14 },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  actions: { gap: 8, paddingTop: 4 },
});