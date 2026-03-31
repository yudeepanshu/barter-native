import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { ProductSummary } from "@barter/types";
import { useSession } from "@/hooks/useSession";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
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
            <View style={[styles.headerCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>My Listings</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                You currently have {visibleItems.length} visible listings.
              </Text>
            </View>
          }
          ListEmptyComponent={<ProductListEmptyState message="You do not have any listings yet." />}
          ListFooterComponent={
            products.query.isFetchingNextPage ? <ProductListFooterLoadingState /> : null
          }
          renderItem={({ item }) => (
            <View style={[styles.itemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Pressable
                onPress={() => router.push(`/(app)/products/${item.id}`)}
                style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.95 : 1 }]}
              >
                <ListingPreview product={item} />
                {(item.status === "ACTIVE" || item.status === "EXCHANGED") ? (
                  <Pressable
                    style={[
                      styles.editIconButton,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                    onPress={() => router.push(`/(app)/listings/${item.id}/edit`)}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={16} color={theme.colors.textPrimary} />
                  </Pressable>
                ) : null}
              </Pressable>
              <View style={[styles.actionBar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                {(item.status === "EXCHANGED" || item.status === "REMOVED") && (
                  <Pressable
                    style={[styles.actionBtn, { borderRightColor: theme.colors.border }]}
                    onPress={() => onRelist(item.id)}
                    disabled={Boolean(relistingId) && relistingId !== item.id}
                  >
                    <Text style={[
                      styles.actionBtnText,
                      { color: theme.colors.textSecondary },
                      relistingId === item.id && relistMutation.isPending && styles.actionBtnLoading,
                    ]}>
                      {relistingId === item.id && relistMutation.isPending ? "Relisting…" : "Relist"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionBtnRight,
                    { borderRightColor: theme.colors.border },
                  ]}
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

function ListingPreview({ product }: { product: ProductSummary }) {
  const { theme } = useAppTheme();
  const primaryImage = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0];
  const isLive = product.status === "ACTIVE";

  return (
    <View style={styles.previewWrap}>
      <View style={styles.imageWrap}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage.url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Feather name="image" size={18} color={theme.colors.textMuted} />
          </View>
        )}
      </View>

      <View style={styles.previewContent}>
        <View style={styles.previewHeaderRow}>
          <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {product.title}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isLive ? "#dcfce7" : theme.colors.surfaceMuted,
                borderColor: isLive ? "#86efac" : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isLive ? "#15803d" : theme.colors.textMuted },
              ]}
            >
              {product.status}
            </Text>
          </View>
        </View>

        <Text style={[styles.previewSub, { color: theme.colors.textMuted }]} numberOfLines={1}>
          {product.category?.name ?? "Uncategorized"} · {product.isFree ? "Free" : "Barter"}
        </Text>

        <Text style={[styles.previewDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {product.description || "No description added yet."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 110 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14 },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardBody: {
    position: "relative",
  },
  previewWrap: {
    padding: 10,
    gap: 10,
  },
  imageWrap: {
    width: "100%",
    height: 168,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewContent: {
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  previewTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    fontWeight: "800",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewSub: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewDesc: {
    fontSize: 14,
    lineHeight: 19,
  },
  editIconButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
  },
  actionBtnRight: {
    borderRightWidth: 0,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
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
