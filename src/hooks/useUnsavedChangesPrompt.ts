import { useEffect } from "react";
import { useNavigation } from "expo-router";
import { useAppDialog } from "@/providers/AppDialogProvider";

interface UseUnsavedChangesPromptOptions {
  enabled: boolean;
  title?: string;
  message?: string;
  keepEditingLabel?: string;
  discardLabel?: string;
  onDiscard?: () => void;
}

export function useUnsavedChangesPrompt({
  enabled,
  title = "Discard changes?",
  message = "You have unsaved changes. Keep editing or discard them?",
  keepEditingLabel = "Keep editing",
  discardLabel = "Discard",
  onDiscard,
}: UseUnsavedChangesPromptOptions) {
  const navigation = useNavigation();
  const dialog = useAppDialog();

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!enabled) {
        return;
      }

      event.preventDefault();
      void (async () => {
        const shouldDiscard = await dialog.confirm(title, message, {
          cancelLabel: keepEditingLabel,
          confirmLabel: discardLabel,
          destructive: true,
        });

        if (shouldDiscard) {
          onDiscard?.();
          navigation.dispatch(event.data.action);
        }
      })();
    });

    return unsubscribe;
  }, [navigation, enabled, title, message, keepEditingLabel, discardLabel, onDiscard, dialog]);
}
