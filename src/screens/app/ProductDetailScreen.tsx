import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { InteractionManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductSummary } from "@barter/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useProductQuery } from "@/hooks/queries/useProductQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { useRequestsQuery } from "@/hooks/queries/useRequestsQuery";
import { useCreateRequestMutation, toErrorMessage } from "@/hooks/mutations/useRequestMutations";
import { useSession } from "@/hooks/useSession";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useProductRoom } from "@/lib/realtime/rooms";
import { useRealtimeToastScope } from "@/lib/realtime/useRealtimeToastScope";
import { useAppDataStore } from "@/lib/store/appDataStore";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { ProductExchangeBadge } from "@/components/products/ProductExchangeBadge";
import {
  ProductMetadata,
  hasExchangeHistory,
  getInactiveExpiryWarning,
  formatDistanceLabel,
  formatLocationBadgeLabel,
} from "@/components/products/ProductMetadata";
import { getContextTag, getTopTypeTag, ProductTag } from "@/components/products/ProductTags";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { OfferComposerForm } from "@/components/requests/OfferComposerForm";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "@/components/layout/KeyboardAwareScrollView";

const MAX_REQUEST_OFFER_AMOUNT = 150000000;

export default function ProductDetailScreen() {
  const router = useRouter();
  const { theme, statusBarStyle } = useAppTheme();
  const session = useSession();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    id?: string;
    offeredProductId?: string;
    backTo?: string;
    distanceKm?: string;
  }>();
  const productId = typeof params.id === "string" ? params.id : "";
  useProductRoom(productId || null);
  useRealtimeToastScope(productId ? { type: "product", productId } : { type: "none" });
  const offeredProductId = typeof params.offeredProductId === "string" ? params.offeredProductId : undefined;
  const backTo = params.backTo === "my-listings" ? "my-listings" : undefined;
  const routeDistanceKm = typeof params.distanceKm === "string" ? Number(params.distanceKm) : Number.NaN;
  const routeDistanceLabel = Number.isFinite(routeDistanceKm)
    ? formatDistanceLabel(routeDistanceKm)
    : null;
  const query = useProductQuery(productId);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [composerReady, setComposerReady] = useState(false);
  const productData = query.data ?? null;
  const previewLocationLabel = formatLocationBadgeLabel(productData?.locationName);
  const isOwner = session?.user.id === productData?.currentOwnerId;
  const handleBack = () => {
    if (backTo === "my-listings") {
      router.replace("/(app)/(tabs)/my-listings");
      return;
    }

    router.back();
  };
  const requestsById = useAppDataStore((state) => state.requestsById);
  const cachedSentRequests = useMemo(
    () => Object.values(requestsById).filter((request) => request.buyerId === session?.user.id),
    [requestsById, session?.user.id],
  );
  const sentRequestsQuery = useRequestsQuery("sent", { limit: 100 }, { enabled: cachedSentRequests.length === 0 });
  const { permission, lastKnown } = useDeviceLocation();

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setComposerReady(true);
    });
    return () => task.cancel();
  }, []);

  const viewerLocation =
    permission === "granted" && lastKnown
      ? { latitude: lastKnown.latitude, longitude: lastKnown.longitude }
      : null;
  const activeRequest = useMemo(() => {
    if (isOwner || !productData) {
      return null;
    }

    const requests = sentRequestsQuery.data?.pages.flatMap((page) => page.items) ?? cachedSentRequests;
    return requests.find(
      (req) => req.productId === productData.id && ["PENDING", "NEGOTIATING", "ACCEPTED"].includes(req.status),
    );
  }, [sentRequestsQuery.data, cachedSentRequests, productData, isOwner]);

  const onManualRefresh = () => {
    setIsManualRefreshing(true);
    query
      .refetch()
      .finally(() => {
        setIsManualRefreshing(false);
      });
  };

  if (query.isPending) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Spinner size={30} />
        </View>
      </SafeAreaView>
    );
  }

  if (query.error || !query.data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
        <View style={styles.errorWrap}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Product not found</Text>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>We could not load this listing.</Text>
          <View style={styles.actions}>
            <Button label="Retry" onPress={() => void query.refetch()} />
            <Button label="Back" variant="ghost" onPress={handleBack} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const product = query.data;
  const canEditListing =
    isOwner &&
    (product.status === "ACTIVE" || product.status === "EXCHANGED" || product.status === "INACTIVE");
  const isRequested = Boolean(activeRequest);
  const typeTag = getTopTypeTag(product);
  const contextTag = getContextTag(product, isRequested);
  const imageFrameSize = Math.max(220, Math.round(width - 68));
  const listedOnDate = (() => {
    const createdAtDate = new Date(product.createdAt);
    if (Number.isNaN(createdAtDate.getTime())) {
      return "Date unavailable";
    }

    return createdAtDate.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAwareScrollView
        containerStyle={styles.keyboardWrap}
        keyboardVerticalOffset={12}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isManualRefreshing} onRefresh={onManualRefresh} />
        }
      >
        <View style={styles.backRow}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={[styles.backButtonText, { color: theme.colors.textPrimary }]}>← Back</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>LISTING</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={2}>
              {product.title}
            </Text>
            <ProductTag tag={typeTag} variant="top-text" />
          </View>

          {product.owner ? (
            <View style={styles.ownerRow}>
              {product.owner.profilePicture ? (
                <Image source={{ uri: product.owner.profilePicture }} style={[styles.ownerAvatar, { backgroundColor: theme.colors.surfaceMuted }]} />
              ) : (
                <View style={[styles.ownerAvatarFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <Text style={[styles.ownerAvatarInitial, { color: theme.colors.primary }]}>
                    {product.owner.userName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.ownerMeta}>
                <Text style={[styles.ownerLabel, { color: theme.colors.textMuted }]}>Listed by</Text>
                <Text style={[styles.ownerName, { color: theme.colors.textPrimary }]}>{product.owner.userName}</Text>
              </View>
              {canEditListing ? (
                <Pressable
                  style={[
                    styles.ownerEditButton,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/listings/[id]/edit",
                      params: {
                        id: product.id,
                        ...(backTo ? { returnTo: backTo } : null),
                      },
                    })
                  }
                  hitSlop={8}
                >
                  <Feather name="edit-2" size={16} color={theme.colors.textPrimary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.description, { color: theme.colors.textMuted }]}>
            {product.description || "No description provided."}
          </Text>

          {isOwner && getInactiveExpiryWarning(product) ? (
            <View
              style={[
                styles.inactiveWarningBanner,
                {
                  backgroundColor: theme.colors.warningSoft,
                  borderColor: theme.mode === "dark" ? "#92400e" : "#fcd34d",
                },
              ]}
            >
              <Feather
                name="alert-triangle"
                size={14}
                color={theme.mode === "dark" ? "#fbbf24" : "#92400e"}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    styles.inactiveWarningText,
                    { color: theme.mode === "dark" ? "#fbbf24" : "#92400e" },
                  ]}
                >
                  {getInactiveExpiryWarning(product)}
                </Text>
                <Text
                  style={[
                    styles.inactiveWarningSubtext,
                    { color: theme.mode === "dark" ? "#d97706" : "#b45309" },
                  ]}
                >
                  Once removed, this listing cannot be relisted.
                </Text>
              </View>
            </View>
          ) : null}

          {product.productImages && product.productImages.length > 0 ? (
            <View style={styles.imageSection}>
              <ScrollView
                horizontal
                snapToInterval={imageFrameSize}
                snapToAlignment="center"
                decelerationRate="fast"
                scrollEnabled={true}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageScrollContent}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / imageFrameSize);
                  setActiveImageIndex(Math.max(0, Math.min(nextIndex, product.productImages.length - 1)));
                }}
                style={[styles.imageCarousel, { width: imageFrameSize, backgroundColor: theme.colors.surfaceMuted }]}
              >
                {product.productImages.map((image) => (
                  <View
                    key={image.id}
                    style={[styles.imageContainer, { width: imageFrameSize, height: imageFrameSize, backgroundColor: theme.colors.surfaceMuted, flexShrink: 0 }]}
                  >
                    <Image
                      source={{ uri: image.url }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    {hasExchangeHistory(product) ? <ProductExchangeBadge /> : null}
                    {isOwner && image.isPrimary ? <Text style={styles.imagePrimaryBadge}>Primary</Text> : null}
                  </View>
                ))}
              </ScrollView>

              {product.productImages.length > 1 ? (
                <View style={styles.imagePagerWrap}>
                  <Text style={[styles.imagePagerText, { color: theme.colors.textMuted }]}>
                    Image {activeImageIndex + 1} of {product.productImages.length}
                  </Text>
                  <View style={styles.imageDotsRow}>
                    {product.productImages.map((image, index) => (
                      <View
                        key={image.id}
                        style={[
                          styles.imageDot,
                          { backgroundColor: theme.colors.border },
                          index === activeImageIndex
                            ? [styles.imageDotActive, { backgroundColor: theme.colors.primary }]
                            : undefined,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.metaSection}>
            {contextTag ? <ProductTag tag={contextTag} variant="bottom-chip" /> : null}
            <ProductMetadata
              product={product}
              variant="detail"
              showProductType={false}
              showLocation={false}
              viewerLocation={viewerLocation}
              fallbackDistanceLabel={previewLocationLabel}
              distanceOverrideLabel={previewLocationLabel ?? routeDistanceLabel}
            />
          </View>
        </View>

        <View
          style={[
            styles.listedOnCard,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={styles.listedOnRow}>
            <Text style={[styles.listedOnLabel, { color: theme.colors.textMuted }]}>Listed on</Text>
            <Text style={[styles.listedOnValue, { color: theme.colors.textPrimary }]}>{listedOnDate}</Text>
          </View>
        </View>

        {activeRequest && !isOwner ? (
          <View
            style={[
              styles.activeRequestCard,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Text style={[styles.activeRequestTitle, { color: theme.colors.onPrimary }]}>Your active request</Text>
            <Text style={[styles.activeRequestStatus, { color: theme.colors.onPrimary }]}> 
              Status: {activeRequest.status}
              {product.status === "INACTIVE" ? " • Product is now inactive" : ""}
            </Text>
            <Button
              label="View request"
              variant="ghost"
              onPress={() => router.push(`/(app)/requests/${activeRequest.id}`)}
            />
          </View>
        ) : null}

          {session && !activeRequest ? (
            composerReady ? (
              <RequestComposer
                product={product}
                sessionUserId={session.user.id}
                initialOfferedProductId={offeredProductId}
              />
            ) : null
          ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function RequestComposer({
  product,
  sessionUserId,
  initialOfferedProductId,
}: {
  product: ProductSummary;
  sessionUserId: string;
  initialOfferedProductId?: string;
}) {
  const router = useRouter();
  const createRequestMutation = useCreateRequestMutation();
  const ownProductsQuery = useProductsListController({
    ownerId: sessionUserId,
    limit: 40,
  });

  const ownOfferableProducts = useMemo(
    () =>
      ownProductsQuery.items.filter(
        (item) => item.id !== product.id && item.status === "ACTIVE" && item.isListed,
      ),
    [ownProductsQuery.items, product.id],
  );
  const ownNonCurrentProducts = useMemo(
    () => ownProductsQuery.items.filter((item) => item.id !== product.id),
    [ownProductsQuery.items, product.id],
  );
  const hasInactiveOrUnlistedProducts = ownNonCurrentProducts.some(
    (item) => item.status === "INACTIVE" || (item.status !== "REMOVED" && !item.isListed),
  );
  const hasOwnedProductsButNoneListed =
    hasInactiveOrUnlistedProducts && ownOfferableProducts.length === 0;

  const { theme } = useAppTheme();
  const [includeMoney, setIncludeMoney] = useState(false);
  const [includeProduct, setIncludeProduct] = useState(true);
  const [offeredProductIds, setOfferedProductIds] = useState<string[]>(() =>
    initialOfferedProductId ? [initialOfferedProductId] : [],
  );
  const [visibleProductIds, setVisibleProductIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const isOwner = product.currentOwnerId === sessionUserId;
  const requestable =
    (product.status === "ACTIVE" || product.status === "RESERVED") && product.isListed;
  const supportsMixedOffers = product.requestByMoney || product.isFree;
  const lockProductSelectionUntilMoney = Boolean(product.requestByMoney) && !product.isFree;
  const wantsMoney = supportsMixedOffers ? includeMoney : false;
  const wantsProduct = supportsMixedOffers ? includeProduct : true;
  const normalizedMinMoneyAmount =
    product.minMoneyAmount != null && Number.isFinite(Number(product.minMoneyAmount))
      ? Number(product.minMoneyAmount)
      : null;
  const effectiveMinMoneyAmount =
    normalizedMinMoneyAmount != null && normalizedMinMoneyAmount > 0
      ? normalizedMinMoneyAmount
      : null;
  const requiresExchangeOffer = !product.isFree;
  const visibleOwnProducts = useMemo(
    () => ownOfferableProducts.filter((item) => !offeredProductIds.includes(item.id)),
    [ownOfferableProducts, offeredProductIds],
  );

  useEffect(() => {
    if (!initialOfferedProductId) {
      return;
    }

    const existsInOwnListings = ownOfferableProducts.some((item) => item.id === initialOfferedProductId);
    if (!existsInOwnListings) {
      return;
    }

    setOfferedProductIds((prev) =>
      prev.includes(initialOfferedProductId) ? prev : [...prev, initialOfferedProductId],
    );
    setIncludeProduct(true);
  }, [initialOfferedProductId, ownOfferableProducts]);

  useEffect(() => {
    if (lockProductSelectionUntilMoney && !includeMoney && !includeProduct) {
      setIncludeProduct(true);
    }
  }, [lockProductSelectionUntilMoney, includeMoney, includeProduct]);

  if (isOwner) {
    return null;
  }

  const submit = async () => {
    setFeedback(null);

    try {
      if (requiresExchangeOffer && !wantsMoney && !wantsProduct) {
        setFeedback("Select at least one offer type.");
        return;
      }

      if (wantsMoney) {
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          setFeedback("Enter a valid positive amount.");
          return;
        }

        if (parsedAmount > MAX_REQUEST_OFFER_AMOUNT) {
          setFeedback("Amount cannot exceed 15 crore.");
          return;
        }
        
        // Validate against minimum only when listing accepts money offers
        if (
          product.requestByMoney &&
          effectiveMinMoneyAmount != null &&
          parsedAmount < effectiveMinMoneyAmount
        ) {
          setFeedback(
            `Minimum amount is ${formatCurrency(effectiveMinMoneyAmount)}. Please enter a higher amount.`,
          );
          return;
        }
      }

      if (wantsProduct && offeredProductIds.length === 0) {
        setFeedback("Select one or more of your listings to offer.");
        return;
      }

      const offerType = wantsMoney && wantsProduct
        ? "MIXED"
        : wantsMoney
          ? "MONEY"
          : wantsProduct
            ? "PRODUCT"
            : "NONE";

      await createRequestMutation.mutateAsync({
        productId: product.id,
        offerType,
        offeredProducts: wantsProduct ? offeredProductIds : undefined,
        visibleProducts: visibleProductIds.length > 0 ? visibleProductIds : undefined,
        amount: wantsMoney ? Number(amount) : undefined,
        contactPreference: "PHONE",
        message: message.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  };

  const toggleOfferedProduct = (nextProductId: string) => {
    setOfferedProductIds((prev) =>
      prev.includes(nextProductId)
        ? prev.filter((productId) => productId !== nextProductId)
        : [...prev, nextProductId],
    );
  };

  const toggleVisibleProduct = (nextProductId: string) => {
    setVisibleProductIds((prev) =>
      prev.includes(nextProductId)
        ? prev.filter((productId) => productId !== nextProductId)
        : [...prev, nextProductId],
    );
  };

  return (
    <View
      style={[
        styles.requestCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.requestTitle, { color: theme.colors.textPrimary }]}>Send Request</Text>
      <Text style={[styles.requestSubtitle, { color: theme.colors.textMuted }]}>Start a negotiation for this listing.</Text>

      {!requestable ? (
        <Text style={styles.warnText}>This listing is not currently requestable.</Text>
      ) : null}

      {requestable ? (
        <OfferComposerForm
          title="Send Request"
          subtitle="Start a negotiation for this listing."
          showHeader={false}
          supportsMixedOffers={supportsMixedOffers}
          includeMoney={includeMoney}
          includeProduct={includeProduct}
          includeProductFirst
          onToggleIncludeMoney={() =>
            setIncludeMoney((prev) => {
              const next = !prev;
              if (!next && lockProductSelectionUntilMoney) {
                setIncludeProduct(true);
              }
              return next;
            })
          }
          onToggleIncludeProduct={() => {
            if (lockProductSelectionUntilMoney && !includeMoney && includeProduct) {
              return;
            }
            setIncludeProduct((prev) => !prev);
          }}
          showAmountField={wantsMoney}
          amountLabel={`Offer amount (${getCurrencySymbol()})`}
          amount={amount}
          onChangeAmount={setAmount}
          amountPlaceholder="Enter amount"
          amountHelperText={
            product.requestByMoney && effectiveMinMoneyAmount != null
              ? `Minimum accepted: ${formatCurrency(effectiveMinMoneyAmount)}`
              : product.requestByMoney && normalizedMinMoneyAmount != null
                ? `Minimum accepted: ${formatCurrency(normalizedMinMoneyAmount)}`
                : undefined
          }
          amountWarningText={
            amount
              ? Number.isFinite(Number(amount))
                ? Number(amount) > MAX_REQUEST_OFFER_AMOUNT
                  ? "Amount cannot exceed 15 crore"
                  : Number(amount) <= 0
                    ? "Amount must be greater than zero"
                    : product.requestByMoney &&
                      effectiveMinMoneyAmount != null &&
                      Number(amount) < effectiveMinMoneyAmount
                      ? `Amount is below the minimum of ${formatCurrency(effectiveMinMoneyAmount)}`
                      : undefined
                : "Please enter a valid amount"
              : undefined
          }
          showProductSelector={wantsProduct}
          productSelectorLabel="Your listing to offer"
          offerableProducts={ownOfferableProducts}
          selectedProductIds={offeredProductIds}
          onToggleProduct={toggleOfferedProduct}
          selectedProductsHint={offeredProductIds.length > 0 ? `${offeredProductIds.length} listing(s) selected.` : undefined}
          showVisibleProductSelector={wantsProduct}
          visibleProductSelectorLabel="Show for consideration"
          visibleProducts={visibleOwnProducts}
          selectedVisibleProductIds={visibleProductIds}
          onToggleVisibleProduct={toggleVisibleProduct}
          noProductsContent={
            ownProductsQuery.query.isPending ? null : (
              <View
                style={[
                  styles.emptyOfferCard,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.emptyOfferTitle, { color: theme.colors.textPrimary }]}>No listing to offer yet.</Text>
                {hasOwnedProductsButNoneListed ? (
                  <>
                    <Text style={[styles.emptyOfferText, { color: theme.colors.textMuted }]}> 
                      You already have products, but none are currently listed.
                    </Text>
                    <View style={styles.emptyOfferActions}>
                      <Button
                        label="See listings"
                        variant="ghost"
                        onPress={() => router.push("/(app)/(tabs)/my-listings")}
                      />
                      <Button
                        label="Create listing"
                        variant="ghost"
                        onPress={() =>
                          router.push({
                            pathname: "/(app)/(tabs)/create",
                            params: { returnToProductId: product.id },
                          })
                        }
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.emptyOfferText, { color: theme.colors.textMuted }]}> 
                      Create one first, then come back and include it in this request.
                    </Text>
                    <Button
                      label="Create listing"
                      variant="ghost"
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/(tabs)/create",
                          params: { returnToProductId: product.id },
                        })
                      }
                    />
                  </>
                )}
              </View>
            )
          }
          loadingProductsText={
            ownProductsQuery.query.isPending
              ? "Loading your listings..."
              : undefined
          }
          message={message}
          onChangeMessage={setMessage}
          messagePlaceholder="Add details for the seller"
          feedback={feedback}
          feedbackColor={theme.colors.textSecondary}
          submitLabel="Send request"
          submitLoading={createRequestMutation.isPending}
          onSubmit={() => {
            void submit();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardWrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorWrap: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  backRow: { marginBottom: 2 },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  title: { flex: 1, minWidth: 0, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  description: { fontSize: 15, lineHeight: 22 },
  inactiveWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  inactiveWarningText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  inactiveWarningSubtext: {
    fontSize: 12,
    lineHeight: 16,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  ownerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerAvatarInitial: {
    fontWeight: "700",
    fontSize: 14,
  },
  ownerMeta: { flex: 1, minWidth: 0 },
  ownerLabel: { fontSize: 11, fontWeight: "600" },
  ownerName: { fontSize: 14, fontWeight: "700" },
  ownerEditButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageSection: {
    marginVertical: 8,
    alignItems: "center",
  },
  imageCarousel: {
    borderRadius: 12,
    overflow: "hidden",
  },
  imageScrollContent: {
    alignItems: "center",
  },
  imageContainer: {
    position: "relative",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  imagePrimaryBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imagePagerWrap: {
    marginTop: 8,
    alignItems: "center",
    gap: 6,
  },
  imagePagerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  imageDotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  imageDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  imageDotActive: {
    width: 18,
  },
  divider: {
    height: 1,
  },
  metaSection: {
    gap: 10,
  },
  activeRequestCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  activeRequestTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  activeRequestStatus: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.9,
  },
  listedOnCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listedOnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  listedOnLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  listedOnValue: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  requestTitle: { fontSize: 16, fontWeight: "700" },
  requestSubtitle: { fontSize: 13 },
  warnText: {
    fontSize: 13,
    color: "#b45309",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 10,
  },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeInfo: { fontSize: 13 },
  offerWrap: { gap: 8 },
  offerLabel: { fontSize: 13, fontWeight: "600" },
  offerList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  offerChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  offerChipActive: {},
  offerChipText: { fontSize: 12, fontWeight: "600" },
  offerChipTextActive: {},
  offerHint: { fontSize: 12 },
  modeChip: { flex: 1, minWidth: 0 },
  emptyOfferCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  emptyOfferActions: {
    gap: 8,
  },
  emptyOfferTitle: { fontSize: 13, fontWeight: "700" },
  emptyOfferText: { fontSize: 12, lineHeight: 18 },
  moneyOfferWrap: { gap: 8 },
  minAmountHint: { gap: 4 },
  minAmountLabel: { fontSize: 12, fontWeight: "500" },
  minAmountWarning: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  feedback: { fontSize: 13, fontStyle: "italic" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
