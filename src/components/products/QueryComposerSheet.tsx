import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SwipeableBottomSheet } from "@/components/ui/SwipeableBottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";
import { sanitizeMultiLineInput } from "@/lib/utils/inputSanitizer";

interface QueryComposerSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: "ask" | "reply";
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
}

export function QueryComposerSheet({
  visible,
  onClose,
  mode,
  onSubmit,
  isSubmitting,
}: QueryComposerSheetProps) {
  const { theme } = useAppTheme();
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAsk = mode === "ask";
  const charOver = text.length > 500;

  const handleClose = () => {
    setText("");
    setFeedback(null);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setFeedback(isAsk ? "Please enter your query." : "Please enter a reply.");
      return;
    }
    if (trimmed.length < 5) {
      setFeedback("Too short — please add more detail.");
      return;
    }
    if (trimmed.length > 500) {
      setFeedback("Too long — maximum 500 characters.");
      return;
    }
    setFeedback(null);
    try {
      await onSubmit(trimmed);
      setText("");
      onClose();
    } catch {
      // error surfaced by parent
    }
  };

  return (
    <SwipeableBottomSheet
      visible={visible}
      onClose={handleClose}
      title={isAsk ? "Ask a query" : "Reply to query"}
      minHeight={320}
    >
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            {isAsk
              ? "Your query will be visible to everyone viewing this listing."
              : "Your reply will be visible to everyone viewing this listing."}
          </Text>
          <Input
            value={text}
            onChangeText={(v) => {
              setText(sanitizeMultiLineInput(v, 500));
              if (feedback) setFeedback(null);
            }}
            placeholder={
              isAsk
                ? "e.g. Do you have a bill for this item?"
                : "Type your reply here..."
            }
            error={feedback}
            multiline
            maxLength={500}
            showCharacterCount
            autoFocus
            returnKeyType="default"
          />
        </View>

        <Button
          label={isAsk ? "Post query" : "Post reply"}
          onPress={() => void handleSubmit()}
          loading={isSubmitting}
          disabled={isSubmitting || charOver}
        />
      </View>
    </SwipeableBottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "space-between",
    gap: 12,
  },
  top: { gap: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
});