import { StyleSheet, Text } from "react-native";
import { useState } from "react";
import { FloatingModal } from "@/components/ui/FloatingModal";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Input } from "@/components/ui/Input";
import { OptionPillMenu, OptionPillMenuItem } from "@/components/filters/OptionPillMenu";
import { Button } from "@/components/ui/Button";
import { sanitizeOptionalText } from "@/lib/utils/inputSanitizer";
import { CustomScrollView } from "@/components/ui/CustomScrollView";

interface ReportModalProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { reportType: T; reason?: string; description?: string }) => void;
  isSubmitting?: boolean;
  title: string;
  subtitle: string;
  options: OptionPillMenuItem[];
  showReason?: boolean;
  showDescription?: boolean;
}

export function ReportModal<T extends string>({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  title,
  subtitle,
  options,
  showReason = true,
  showDescription = true,
}: ReportModalProps<T>) {
  const { theme } = useAppTheme();
  const [selectedType, setSelectedType] = useState<T | "">("");
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
      reason: sanitizeOptionalText(reason, 120),
      description: sanitizeOptionalText(description, 500),
    });
  };

  const canSubmit = Boolean(selectedType) && !isSubmitting;

  return (
    <FloatingModal visible={visible} title={title} onClose={handleClose}>
      <CustomScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {subtitle}
        </Text>

        <OptionPillMenu
          items={options}
          selectedValue={selectedType}
          onSelect={(value: any) => setSelectedType(value as T)}
        />

        {showReason && (
          <Input
            label="Reason"
            placeholder="Brief reason..."
            value={reason}
            onChangeText={setReason}
            maxLength={120}
            showCharacterCount
          />
        )}

        {showDescription && (
          <Input
            label="Details"
            placeholder="Additional details..."
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            showCharacterCount
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
        )}

        <Button
          label="Submit Report"
          loading={isSubmitting}
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </CustomScrollView>
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
});