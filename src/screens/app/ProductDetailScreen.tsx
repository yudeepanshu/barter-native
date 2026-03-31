import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import type { ProductSummary } from "@barter/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useProductQuery } from "@/hooks/queries/useProductQuery";
import { useProductsListController } from "@/hooks/queries/useProductsListController";
import { useCreateRequestMutation, toErrorMessage } from "@/hooks/mutations/useRequestMutations";
import { useSession } from "@/hooks/useSession";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "ACTIVE": return { bg: "#dcfce7", text: "#15803d" };
    case "RESERVED": return { bg: "#dbeafe", text: "#1d4ed8" };
    case "EXCHANGED": return { bg: "#ccfbf1", text: "#0f766e" };
    case "REMOVED": return { bg: "#fee2e2", text: "#b91c1c" };
    default: return { bg: "#e2e8f0", text: "#334155" };
  }
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { theme, statusBarStyle } = useAppTheme();
  const session = useSession();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = typeof params.id === "string" ? params.id : "";
  const query = useProductQuery(productId);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const product = query.data;
  const badgeStyle = getStatusBadgeStyle(product.status);
  const imageFrameSize = Math.max(220, Math.round(width - 68));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
          }
        >
        <View style={styles.backRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: theme.colors.textPrimary }]}>← Back</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>LISTING</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={2}>
              {product.title}
            </Text>
            <View style={[styles.badgeWrap, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[styles.badgeText, { color: badgeStyle.text }]} numberOfLines={1}>
                {product.status}
              </Text>
            </View>
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
            </View>
          ) : null}

          <Text style={[styles.description, { color: theme.colors.textMuted }]}>
            {product.description || "No description provided."}
          </Text>

          {product.productImages && product.productImages.length > 0 ? (
            <View style={styles.imageSection}>
              <ScrollView
                horizontal
                pagingEnabled
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
                    style={[styles.imageContainer, { width: imageFrameSize, height: imageFrameSize, backgroundColor: theme.colors.surfaceMuted }]}
                  >
                    <Image
                      source={{ uri: image.url }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    {image.isPrimary && <Text style={styles.imagePrimaryBadge}>Primary</Text>}
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

          <View style={styles.metaWrap}>
            <View style={[styles.metaChip, styles.metaChipCategory]}>
              <Text style={[styles.metaChipText, styles.metaChipTextCategory]}>
                {product.category?.name ?? "Uncategorized"}
              </Text>
            </View>
            <View
              style={[
                styles.metaChip,
                product.isFree
                  ? styles.metaChipFree
                  : product.requestByMoney
                    ? styles.metaChipMoney
                    : styles.metaChipBarter,
              ]}
            >
              <Text
                style={[
                  styles.metaChipText,
                  product.isFree
                    ? styles.metaChipTextFree
                    : product.requestByMoney
                      ? styles.metaChipTextMoney
                      : styles.metaChipTextBarter,
                ]}
              >
                {product.isFree ? "Free" : product.requestByMoney ? "Open to offers" : "Barter"}
              </Text>
            </View>
            {product.locationName ? (
              <View style={[styles.metaChip, styles.metaChipLocation]}>
                <Text style={[styles.metaChipText, styles.metaChipTextLocation]}>
                  {product.locationName}
                </Text>
              </View>
            ) : null}
            {product.isPreOwned && product.exchangeCount > 0 ? (
              <View style={[styles.metaChip, styles.metaChipExchanged]}>
                <Text style={[styles.metaChipText, styles.metaChipTextExchanged]}>
                  Previously exchanged
                </Text>
              </View>
            ) : null}
          </View>
        </View>

          {session ? <RequestComposer product={product} sessionUserId={session.user.id} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RequestComposer({
  product,
  sessionUserId,
}: {
  product: ProductSummary;
  sessionUserId: string;
}) {
  const router = useRouter();
  const createRequestMutation = useCreateRequestMutation();
  const ownProductsQuery = useProductsListController({
    ownerId: sessionUserId,
    status: "ACTIVE",
    limit: 40,
  });

  const ownOfferableProducts = useMemo(
    () => ownProductsQuery.items.filter((item) => item.id !== product.id && item.isListed),
    [ownProductsQuery.items, product.id],
  );

  const { theme } = useAppTheme();
  const [includeMoney, setIncludeMoney] = useState(!product.isFree && product.requestByMoney);
  const [includeProduct, setIncludeProduct] = useState(!product.isFree && !product.requestByMoney);
  const [offeredProductIds, setOfferedProductIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const isOwner = product.currentOwnerId === sessionUserId;
  const requestable =
    (product.status === "ACTIVE" || product.status === "RESERVED") && product.isListed;
  const supportsMixedOffers = product.requestByMoney || product.isFree;
  const wantsMoney = supportsMixedOffers ? includeMoney : false;
  const wantsProduct = supportsMixedOffers ? includeProduct : true;
  const requiresExchangeOffer = !product.isFree;

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
        <>
          <View style={styles.modeRow}>
            {supportsMixedOffers ? (
              <>
                <Button
                  label="Include money"
                  variant={includeMoney ? "primary" : "ghost"}
                  onPress={() => setIncludeMoney((prev) => !prev)}
                />
                <Button
                  label="Include product"
                  variant={includeProduct ? "primary" : "ghost"}
                  onPress={() => setIncludeProduct((prev) => !prev)}
                />
              </>
            ) : (
              <Text style={[styles.modeInfo, { color: theme.colors.textMuted }]}>This listing accepts product offers only.</Text>
            )}
          </View>

          {wantsMoney ? (
            <Input
              label="Offer amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          ) : null}

          {wantsProduct ? (
            <View style={styles.offerWrap}>
              <Text style={[styles.offerLabel, { color: theme.colors.textSecondary }]}>Your listing to offer</Text>
              {ownOfferableProducts.length > 0 ? (
                <>
                  <View style={styles.offerList}>
                    {ownOfferableProducts.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => toggleOfferedProduct(item.id)}
                        style={[
                          styles.offerChip,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.surfaceMuted,
                          },
                          offeredProductIds.includes(item.id)
                            ? [styles.offerChipActive, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]
                            : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            styles.offerChipText,
                            { color: theme.colors.textSecondary },
                            offeredProductIds.includes(item.id)
                              ? [styles.offerChipTextActive, { color: theme.colors.onPrimary }]
                              : undefined,
                          ]}
                        >
                          {item.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {offeredProductIds.length > 0 ? (
                    <Text style={[styles.offerHint, { color: theme.colors.textMuted }]}>{offeredProductIds.length} listing(s) selected.</Text>
                  ) : null}
                </>
              ) : ownProductsQuery.query.isPending ? null : (
                <View
                  style={[
                    styles.emptyOfferCard,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <Text style={[styles.emptyOfferTitle, { color: theme.colors.textPrimary }]}>No listing to offer yet.</Text>
                  <Text style={[styles.emptyOfferText, { color: theme.colors.textMuted }]}>
                    Create one first, then come back and include it in this request.
                  </Text>
                  <Button
                    label="Create listing"
                    variant="ghost"
                    onPress={() => router.push("/(app)/(tabs)/create")}
                  />
                </View>
              )}
              {ownProductsQuery.query.isPending ? (
                <Text style={[styles.offerHint, { color: theme.colors.textMuted }]}>Loading your listings...</Text>
              ) : null}
            </View>
          ) : null}

          <Input
            label="Message (optional)"
            value={message}
            onChangeText={setMessage}
            placeholder="Add details for the seller"
          />

          {feedback ? <Text style={[styles.feedback, { color: theme.colors.textSecondary }]}>{feedback}</Text> : null}

          <Button
            label="Send request"
            loading={createRequestMutation.isPending}
            onPress={() => void submit()}
          />
        </>
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
    alignItems: "flex-start",
  },
  title: { flex: 1, minWidth: 0, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  badgeWrap: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    flexShrink: 0,
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  description: { fontSize: 15, lineHeight: 22 },
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
  metaWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  metaChipText: { fontSize: 12, fontWeight: "700" },
  // Category — neutral slate
  metaChipCategory: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  metaChipTextCategory: { color: "#475569" },
  // Free — green
  metaChipFree: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  metaChipTextFree: { color: "#166534" },
  // Open to money offers — amber
  metaChipMoney: { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  metaChipTextMoney: { color: "#92400e" },
  // Barter only — indigo
  metaChipBarter: { backgroundColor: "#ede9fe", borderColor: "#c4b5fd" },
  metaChipTextBarter: { color: "#4c1d95" },
  // Location — sky blue
  metaChipLocation: { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" },
  metaChipTextLocation: { color: "#0c4a6e" },
  metaChipExchanged: { backgroundColor: "#ffedd5", borderColor: "#fdba74" },
  metaChipTextExchanged: { color: "#9a3412" },
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
  emptyOfferCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  emptyOfferTitle: { fontSize: 13, fontWeight: "700" },
  emptyOfferText: { fontSize: 12, lineHeight: 18 },
  feedback: { fontSize: 13, fontStyle: "italic" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
