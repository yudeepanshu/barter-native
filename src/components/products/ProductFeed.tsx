import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { RequestStatus } from "@barter/types";
import { useCategoriesQuery } from "@/hooks/queries/useCategoriesQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useProductFeedFilters } from "@/hooks/useProductFeedFilters";
import { Input } from "@/components/ui/Input";
import { ProductCard } from "@/components/products/ProductCard";
import {
  ProductListEmptyState,
  ProductListErrorState,
  ProductListFooterLoadingState,
  ProductListLoadingState,
} from "@/components/products/ProductListStates";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AppCard } from "@/components/ui/AppCard";

const REQUESTED_STATUSES: RequestStatus[] = ["PENDING", "NEGOTIATING", "ACCEPTED"];

interface ProductFeedProps {
  userId: string;
  userName: string;
}

export function ProductFeed({ userId, userName }: ProductFeedProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const filterState = useProductFeedFilters({ limit: 20, excludeOwnerId: userId });
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false);

  const categoriesQuery = useCategoriesQuery();
  const products = useProductsListController(filterState.filters);
  const sentRequestsQuery = useRequestsQuery("sent", { limit: 100 });

  const categories = categoriesQuery.data ?? [];
  const requestedProductIds = useMemo(() => {
    const items = sentRequestsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return new Set(
      items
        .filter((item) => REQUESTED_STATUSES.includes(item.status))
        .map((item) => item.productId),
    );
  }, [sentRequestsQuery.data]);

  const showInitialLoading = products.query.isPending && products.items.length === 0;
  const showInitialError = Boolean(products.query.error) && products.items.length === 0;

  useEffect(() => {
    if (!showInitialLoading) {
      setInitialLoadTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setInitialLoadTimedOut(true);
    }, 9000);

    return () => clearTimeout(timer);
  }, [showInitialLoading]);

  return (
    <FlatList
      data={products.items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
      removeClippedSubviews
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      refreshControl={
        <RefreshControl refreshing={products.query.isRefetching} onRefresh={products.refresh} />
      }
      onEndReachedThreshold={0.35}
      onEndReached={products.loadMore}
      ListHeaderComponent={
        <AppCard>
          <View style={styles.greetingRow}>
            <View style={styles.greetingContent}>
              <Text style={[styles.greeting, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                Hello, {userName}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={2}>
                Discover high-value listings near you
              </Text>
            </View>
          </View>

          <Input
            label="Search listings"
            placeholder="Try bicycle, books, guitar..."
            value={filterState.search}
            onChangeText={filterState.setSearch}
          />
          {filterState.isSearchDebouncing ? (
            <Text style={[styles.searchHint, { color: theme.colors.textMuted }]}>Updating results...</Text>
          ) : null}

          <View>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <CategoryChip
                active={filterState.categoryId === ""}
                label="All"
                onPress={() => filterState.setCategoryId("")}
              />
              {categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  active={filterState.categoryId === category.id}
                  label={category.name}
                  onPress={() => filterState.setCategoryId(category.id)}
                />
              ))}
            </ScrollView>
          </View>

          {products.isEmpty && !showInitialLoading && !showInitialError ? (
            <ProductListEmptyState message="No listings found for the current filters." />
          ) : null}
        </AppCard>
      }
      ListEmptyComponent={
        showInitialLoading ? (
          initialLoadTimedOut ? (
            <ProductListErrorState
              message="Loading is taking longer than expected. Check your connection and retry."
              onRetry={products.refresh}
            />
          ) : (
            <ProductListLoadingState spinnerSize={30} />
          )
        ) : showInitialError ? (
          <ProductListErrorState
            message="Could not load listings. Please try again."
            onRetry={products.refresh}
          />
        ) : null
      }
      ListFooterComponent={
        products.query.isFetchingNextPage ? <ProductListFooterLoadingState /> : null
      }
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onPress={() => router.push(`/(app)/products/${item.id}`)}
          showMeta
          isRequested={requestedProductIds.has(item.id)}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.colors.chipActiveBg : theme.colors.border,
          backgroundColor: active ? theme.colors.chipActiveBg : theme.colors.chipBg,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: active ? theme.colors.chipActiveText : theme.colors.chipText }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 108, gap: 2 },
  headerSection: {
    gap: 14,
    marginBottom: 12,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  greetingContent: { flexGrow: 1, flexShrink: 1, minWidth: 180, paddingRight: 2 },
  greeting: { fontSize: 24, lineHeight: 29, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 3 },
  searchHint: { fontSize: 12, color: "#64748b", marginTop: -4 },
  sectionLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    maxWidth: 160,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
});
