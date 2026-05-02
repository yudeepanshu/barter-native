import { StyleSheet, Text, ScrollView, Pressable } from "react-native";
import { useState } from "react";
import { FloatingModal } from "@/components/ui/FloatingModal";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Input } from "@/components/ui/Input";
import { OptionPillMenu, OptionPillMenuItem } from "@/components/filters/OptionPillMenu";

const REPORT_TYPE_OPTIONS: OptionPillMenuItem[] = [
  { key: "ABUSIVE_CONTENT", value: "ABUSIVE_CONTENT", label: "Abusive Content" },
  { key: "SPAM_SCAM", value: "SPAM_SCAM", label: "Spam or Scam" },
  { key: "INAPPROPRIATE", value: "INAPPROPRIATE", label: "Inappropriate" },
  { key: "PROHIBITED_ITEM", value: "PROHIBITED_ITEM", label: "Prohibited Item" },
  { key: "INACCURATE_LISTING", value: "INACCURATE_LISTING", label: "Inaccurate Listing" },
  { key: "OTHER", value: "OTHER", label: "Other" },
];

type ReportType = (typeof REPORT_TYPE_OPTIONS)[number]["value"];

interface ReportProductModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { reportType: ReportType; reason?: string; description?: string }) => void;
  isSubmitting?: boolean;
}

export function ReportProductModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: ReportProductModalProps) {
  const { theme } = useAppTheme();
  const [selectedType, setSelectedType] = useState<ReportType | "">("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const handleClose = () => {
    setSelectedType("");
    setReason("");
    setDescription("");
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedType) return;
    onSubmit({
      reportType: selectedType,
      reason: reason.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  const canSubmit = Boolean(selectedType) && !isSubmitting;

  return (
    <FloatingModal visible={visible} title="Report Listing" onClose={handleClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          What's wrong with this listing?
        </Text>

        <OptionPillMenu
          items={REPORT_TYPE_OPTIONS}
          selectedValue={selectedType}
          onSelect={(value: any) => setSelectedType(value as ReportType)}
        />

        <Input
          label="Reason"
          placeholder="Brief reason..."
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          showCharacterCount
        />

        <Input
          label="Details"
          placeholder="Additional details..."
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          showCharacterCount
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />

        <Pressable
          style={[
            styles.submitButton,
            {
              backgroundColor: canSubmit ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text
            style={[
              styles.submitLabel,
              { color: canSubmit ? theme.colors.textPrimary : theme.colors.textMuted },
            ]}
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Text>
        </Pressable>
      </ScrollView>
    </FloatingModal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 540,
  },
  scrollContent: {
    gap: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
});