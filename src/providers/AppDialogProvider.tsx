import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type AppDialogActionRole = "default" | "cancel" | "destructive";

export interface AppDialogAction {
  key: string;
  label: string;
  role?: AppDialogActionRole;
}

export interface AppDialogOptions {
  title: string;
  message?: string;
  actions: AppDialogAction[];
  showCloseButton?: boolean;
  disableDismiss?: boolean;
  dismissOnBackdrop?: boolean;
}

interface PendingDialog extends AppDialogOptions {
  resolve: (actionKey: string | null) => void;
}

interface AppDialogContextValue {
  show: (options: AppDialogOptions) => Promise<string | null>;
  alert: (title: string, message?: string, actionLabel?: string) => Promise<void>;
  confirm: (
    title: string,
    message?: string,
    options?: {
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
    },
  ) => Promise<boolean>;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  const [pendingDialog, setPendingDialog] = useState<PendingDialog | null>(null);

  const show = useCallback((options: AppDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      setPendingDialog({ ...options, resolve });
    });
  }, []);

  const alert = useCallback(
    async (title: string, message?: string, actionLabel = "OK") => {
      await show({
        title,
        message,
        actions: [{ key: "ok", label: actionLabel }],
      });
    },
    [show],
  );

  const confirm = useCallback(
    async (
      title: string,
      message?: string,
      options?: {
        confirmLabel?: string;
        cancelLabel?: string;
        destructive?: boolean;
      },
    ) => {
      const key = await show({
        title,
        message,
        actions: [
          { key: "cancel", label: options?.cancelLabel ?? "Cancel", role: "cancel" },
          {
            key: "confirm",
            label: options?.confirmLabel ?? "Confirm",
            role: options?.destructive ? "destructive" : "default",
          },
        ],
      });

      return key === "confirm";
    },
    [show],
  );

  const contextValue = useMemo<AppDialogContextValue>(
    () => ({ show, alert, confirm }),
    [show, alert, confirm],
  );

  const onClose = (actionKey: string | null) => {
    if (!pendingDialog) {
      return;
    }

    const { resolve } = pendingDialog;
    setPendingDialog(null);
    resolve(actionKey);
  };

  return (
    <AppDialogContext.Provider value={contextValue}>
      {children}
      <Modal
        visible={Boolean(pendingDialog)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pendingDialog?.disableDismiss) {
            return;
          }
          onClose(null);
        }}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => {
            if (!pendingDialog || pendingDialog.disableDismiss || !pendingDialog.dismissOnBackdrop) {
              return;
            }
            onClose(null);
          }}
        >
          <Pressable
            style={[
              styles.dialogCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => {
              // Prevent backdrop press from firing when tapping inside dialog.
            }}
          >
            {pendingDialog ? (
              <>
                {pendingDialog.showCloseButton ? (
                  <Pressable
                    style={[styles.closeButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                    onPress={() => onClose(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close dialog"
                  >
                    <Text style={[styles.closeButtonLabel, { color: theme.colors.textSecondary }]}>×</Text>
                  </Pressable>
                ) : null}
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{pendingDialog.title}</Text>
                {pendingDialog.message ? (
                  <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{pendingDialog.message}</Text>
                ) : null}
                <View style={styles.actionsRow}>
                  {pendingDialog.actions.map((action) => {
                    const isDestructive = action.role === "destructive";
                    const isCancel = action.role === "cancel";
                    return (
                      <Pressable
                        key={action.key}
                        onPress={() => onClose(action.key)}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: isCancel ? theme.colors.surfaceMuted : theme.colors.surface,
                            opacity: pressed ? 0.86 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionLabel,
                            {
                              color: isDestructive ? theme.colors.danger : theme.colors.textPrimary,
                            },
                          ]}
                        >
                          {action.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used inside AppDialogProvider");
  }

  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dialogCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: {
    paddingRight: 36,
    fontSize: 28,
    fontWeight: "800",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionsRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  actionBtn: {
    minWidth: 120,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  closeButtonLabel: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
  },
});
