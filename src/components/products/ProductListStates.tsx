import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

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
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorText}>{message}</Text>
      <Button label="Retry" onPress={onRetry} />
    </View>
  );
}

export function ProductListEmptyState({ message }: EmptyStateProps) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
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
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorText: { color: "#b91c1c", fontSize: 13 },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 14,
  },
  emptyText: { color: "#475569", fontSize: 13, textAlign: "center" },
  footerLoading: { paddingVertical: 12 },
});
