import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAppTheme } from "@/hooks/useAppTheme";

interface LoadingStateProps {
  spinnerSize?: number;
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

interface EmptyStateProps {
  message: string;
}

export function ProductListLoadingState({ spinnerSize = 30 }: LoadingStateProps) {
  return (
    <View style={styles.centerState}>
      <Spinner size={spinnerSize} />
    </View>
  );
}

export function ProductListErrorState({ message, onRetry }: ErrorStateProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.errorCard, { borderColor: theme.colors.dangerSoft, backgroundColor: theme.colors.dangerSoft }]}> 
      <Text style={[styles.errorText, { color: theme.colors.danger }]}>{message}</Text>
      <Button label="Retry" onPress={onRetry} />
    </View>
  );
}

export function ProductListEmptyState({ message }: EmptyStateProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}> 
      <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{message}</Text>
    </View>
  );
}

export function ProductListFooterLoadingState() {
  return (
    <View style={styles.footerLoading}>
      <Spinner size={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  centerState: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorText: { fontSize: 13 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
  footerLoading: { paddingVertical: 12 },
});
