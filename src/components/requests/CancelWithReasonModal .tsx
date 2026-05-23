import { useState } from "react";
import { FloatingModal } from "@/components/ui/FloatingModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";
import { StyleSheet, View } from "react-native";
import { sanitizeMultiLineInput } from "@/lib/utils/inputSanitizer";

const MIN_REASON_LENGTH = 15;
const MAX_REASON_LENGTH = 120;

interface CancelModalStaticConfig {
  title: string;
  confirmLabel: string;
  placeholder?: string;
}

export const CANCEL_MODAL_CONFIGS = {
  cancelSingleRequest: {
    title: "Cancel Request",
    confirmLabel: "Confirm Cancellation",
    placeholder: "Reason for cancellation",
  },
  cancelAllRequests: {
    title: "Cancel All Requests",
    confirmLabel: "Cancel All",
    placeholder: "Reason for cancelling all other requests",
  },
  rejectOffer: {
    title: "Reject Offer",
    confirmLabel: "Reject Offer",
    placeholder: "Reason for rejecting this offer",
  },
} as const satisfies Record<string, CancelModalStaticConfig>;

export type CancelModalKey = keyof typeof CANCEL_MODAL_CONFIGS;

interface CancelWithReasonModalProps {
  /** Which action is active. null = modal hidden. */
  activeKey: CancelModalKey | null;
  loading: boolean;
  onConfirm: (key: CancelModalKey, reason: string) => void;
  onClose: () => void;
}

export function CancelWithReasonModal({
  activeKey,
  loading,
  onConfirm,
  onClose,
}: CancelWithReasonModalProps) {
  const { theme } = useAppTheme();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const config = activeKey ? CANCEL_MODAL_CONFIGS[activeKey] : null;
  const isConfirmDisabled = reason.trim().length < MIN_REASON_LENGTH;

  const handleClose = () => {
    setReason("");
    setError(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!activeKey) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    if (trimmed.length > MAX_REASON_LENGTH) {
      setError(`Reason must be ${MAX_REASON_LENGTH} characters or fewer.`);
      return;
    }
    onConfirm(activeKey, trimmed);
  };

  return (
    <FloatingModal
      visible={activeKey !== null}
      title={config?.title ?? ""}
      preferCenter
      onClose={handleClose}
    >
      <Input
        value={reason}
        onChangeText={(value) => {
          setReason(sanitizeMultiLineInput(value, MAX_REASON_LENGTH));
          if (error) setError(null);
        }}
        placeholder={config?.placeholder ?? "Reason for cancellation"}
        autoCapitalize="sentences"
        autoCorrect
        maxLength={MAX_REASON_LENGTH}
        showCharacterCount
        error={error}
        multiline
        style={styles.textArea}
      />

      <View style={styles.buttonGroup}>
        <Button
          label={config?.confirmLabel ?? "Confirm"}
          style={[
            styles.confirmButton,
            { backgroundColor: theme.colors.danger, opacity: isConfirmDisabled ? 0.45 : 1 },
          ]}
          textColor="#ffffff"
          labelStyle={styles.confirmLabel}
          loading={loading}
          disabled={isConfirmDisabled}
          onPress={handleConfirm}
        />

        <Button
          label="Go Back"
          variant="ghost"
          style={styles.backButton}
          textColor={theme.colors.textSecondary}
          onPress={handleClose}
        />
      </View>
    </FloatingModal>
  );
}

const styles = StyleSheet.create({
  textArea: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  confirmButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 0,
  },
  confirmLabel: {
    fontWeight: "700",
    fontSize: 15,
  },
  backButton: {
    minHeight: 44,
    borderRadius: 12,
  },
  buttonGroup: {
    gap: 8,
  },
});