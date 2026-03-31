import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useSession } from "@/hooks/useSession";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { ProductCard } from "@/components/products/ProductCard";
import {
  toErrorMessage,
  useDeleteProductMutation,
} from "@/hooks/mutations/useDeleteProductMutation";
import {
  toErrorMessage as toRelistErrorMessage,
  useRelistProductMutation,
} from "@/hooks/mutations/useRelistProductMutation";
import {
  ProductListEmptyState,
  ProductListErrorState,
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function MyListingsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const session = useSession();
  const deleteMutation = useDeleteProductMutation();
  const relistMutation = useRelistProductMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const products = useProductsListController({ ownerId: session?.user.id, limit: 20 });
  const visibleItems = useMemo(
    () => products.items.filter((item) => item.status !== "REMOVED"),
    [products.items],
  );

  const onDelete = (productId: string) => {
    Alert.alert("Delete listing", "Delete this listing permanently? This action cannot be undone.", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setDeletingId(productId);
          deleteMutation
            .mutateAsync(productId)
            .catch((error) => {
              Alert.alert("Delete failed", toErrorMessage(error));
            })
            .finally(() => {
              setDeletingId(null);
            });
        },
      },
    ]);
  };

  const onRelist = (productId: string) => {
    Alert.alert("Relist product", "Relist this product? It will become ACTIVE and visible to buyers.", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Relist",
        onPress: () => {
          setRelistingId(productId);
          relistMutation
            .mutateAsync(productId)
            .catch((error) => {
              Alert.alert("Relist failed", toRelistErrorMessage(error));
            })
            .finally(() => {
              setRelistingId(null);
            });
        },
      },
    ]);
  };

  if (!session || products.query.isPending) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <ProductListLoadingState spinnerSize={30} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      {products.query.error ? (
        <View style={styles.errorWrap}>
          <ProductListErrorState
            message="Could not load your listings. Please try again."
            onRetry={products.refresh}
          />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={products.query.isRefetching} onRefresh={products.refresh} />
          }
          onEndReachedThreshold={0.35}
          onEndReached={products.loadMore}
          ListHeaderComponent={
            <View style={styles.headerCard}>
              <Text style={styles.title}>My Listings</Text>
              <Text style={styles.subtitle}>
                You currently have {visibleItems.length} visible listings.
              </Text>
            </View>
          }
          ListEmptyComponent={<ProductListEmptyState message="You do not have any listings yet." />}
          ListFooterComponent={
            products.query.isFetchingNextPage ? <ProductListFooterLoadingState /> : null
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.cardBody}>
                <ProductCard
                  product={item}
                  onPress={() => router.push(`/(app)/products/${item.id}`)}
                  showMeta={false}
                />
                {(item.status === "ACTIVE" || item.status === "EXCHANGED") ? (
                  <Pressable
                    style={styles.editIconButton}
                    onPress={() => router.push(`/(app)/listings/${item.id}/edit`)}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={16} color="#0f172a" />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.actionBar}>
                {(item.status === "EXCHANGED" || item.status === "REMOVED") && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => onRelist(item.id)}
                    disabled={Boolean(relistingId) && relistingId !== item.id}
                  >
                    <Text style={[
                      styles.actionBtnText,
                      relistingId === item.id && relistMutation.isPending && styles.actionBtnLoading,
                    ]}>
                      {relistingId === item.id && relistMutation.isPending ? "Relisting…" : "Relist"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnRight]}
                  onPress={() => onDelete(item.id)}
                  disabled={Boolean(deletingId) && deletingId !== item.id}
                >
                  <Text style={[
                    styles.actionBtnText,
                    styles.actionBtnTextDestructive,
                    deletingId === item.id && deleteMutation.isPending && styles.actionBtnLoading,
                  ]}>
                    {deletingId === item.id && deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  listContent: { padding: 16, paddingBottom: 110 },
  headerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#475569" },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  cardBody: {
    position: "relative",
  },
  editIconButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  actionBtnRight: {
    borderRightWidth: 0,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  actionBtnTextDestructive: {
    color: "#ef4444",
  },
  actionBtnLoading: {
    opacity: 0.5,
  },
  errorWrap: {
    margin: 16,
  },
});
