import React, { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ProductSummary } from "@barter/types";
import { OfferComposerForm } from "@/components/requests/OfferComposerForm";
import { Button } from "@/components/ui/Button";
import { useTopToastStore } from "@/lib/ui/topToastStore";

interface CounterOfferFormProps {
  product: ProductSummary & { isFree?: boolean; requestByMoney?: boolean };
  onSubmit: (payload: {
    offerType: "PRODUCT" | "MONEY" | "MIXED" | "NONE";
    offeredProducts?: string[];
    visibleProducts?: string[];
    requestedProducts?: string[];
    amount?: number;
    message?: string;
  }) => Promise<void>;
  ownOfferableProducts: ProductSummary[];
  counterpartyProducts: ProductSummary[];
  requesterProfile?: { userName: string; profilePicture?: string | null };
  loading?: boolean;
  onCancel?: () => void;
  /** True when the current actor is the buyer. Controls whether minAmount enforcement applies. */
  isBuyer: boolean;
  /** Effective floor for the buyer's money offer. null = no limit (seller) or not applicable. */
  effectiveMinAmount?: number | null;
  /** Whether it's currently this user's turn to counter. Controls form enable/disable. */
  canCounter: boolean;
  /** User's ID to identify their previous offers for duplicate detection */
  userId: string;
  /** All offers for duplicate detection against user's last offer */
  allOffers?: Array<{ id: string; offeredById: string; offeredAmount?: string | number | null; offeredProducts?: Array<{ id: string }> }>;
  /** Callback when user wants to see their listings */
  onGoToMyListings?: () => void;
  /** Callback when user wants to create a new listing */
  onCreateListing?: () => void;
  /** Previous offer details for comparison snapshot */
  previousOffer?: { amount?: number | string | null; productCount?: number };
  /** Initial request-level consideration products belonging to current user */
  initialVisibleProductIds?: string[];
  /** Initial own products to preselect in the counter form */
  initialOfferedProductIds?: string[];
  /** Initial requester products to preselect in the counter form */
  initialRequestedProductIds?: string[];
  /** Initial amount to prefill from the latest active offer */
  initialAmount?: number | string | null;
}

export const CounterOfferForm: React.FC<CounterOfferFormProps> = ({
  product,
  onSubmit,
  ownOfferableProducts,
  counterpartyProducts,
  requesterProfile,
  loading,
  onCancel,
  isBuyer,
  effectiveMinAmount,
  canCounter,
  userId,
  allOffers = [],
  onGoToMyListings,
  onCreateListing,
  previousOffer,
  initialVisibleProductIds = [],
  initialOfferedProductIds = [],
  initialRequestedProductIds = [],
  initialAmount,
}) => {
  const { theme } = useAppTheme();
  const enqueueToast = useTopToastStore((state) => state.enqueueToast);
  const canOfferOwnProducts = isBuyer;
  const canRequestCounterpartyProducts = counterpartyProducts.length > 0;
  const canUseProductMode =
    canOfferOwnProducts || canRequestCounterpartyProducts || !Boolean(product.requestByMoney);
  const supportsMixedOffers = !product.isFree && Boolean(product.requestByMoney) && canUseProductMode;
  const [includeMoney, setIncludeMoney] = useState(!product.isFree && Boolean(product.requestByMoney));
  const [includeProduct, setIncludeProduct] = useState(!product.isFree && canUseProductMode);
  const [counterAmount, setCounterAmount] = useState(
    initialAmount != null && Number.isFinite(Number(initialAmount)) ? String(Number(initialAmount)) : ""
  );
  const [counterOfferedProductIds, setCounterOfferedProductIds] = useState<string[]>(initialOfferedProductIds);
  const [counterVisibleProductIds, setCounterVisibleProductIds] = useState<string[]>(initialVisibleProductIds);
  const [counterRequestedProductIds, setCounterRequestedProductIds] = useState<string[]>(initialRequestedProductIds);
  const [offeredTouched, setOfferedTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [visibleTouched, setVisibleTouched] = useState(false);
  const [requestedTouched, setRequestedTouched] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectableOwnProducts = ownOfferableProducts.filter((p) => p.id !== product.id);

  const buyerHasNoProducts = isBuyer && selectableOwnProducts.length === 0 && !canRequestCounterpartyProducts;
  const shouldDisableProductToggle = supportsMixedOffers && buyerHasNoProducts;

  const moneyOnlyCounterMode = !product.isFree && !canUseProductMode && Boolean(product.requestByMoney);
  const wantsMoney = moneyOnlyCounterMode || shouldDisableProductToggle ? true : supportsMixedOffers ? includeMoney : false;
  const wantsProduct =
    product.isFree || moneyOnlyCounterMode || shouldDisableProductToggle
      ? false
      : supportsMixedOffers
        ? includeProduct
        : canUseProductMode;

  const showsAmountField = wantsMoney;
  const parsedAmount = Number(counterAmount);
  const isBelowMin =
    isBuyer &&
    effectiveMinAmount != null &&
    showsAmountField &&
    counterAmount.trim() !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount < effectiveMinAmount;

  // Visible products: exclude target product and already-offered products
  const visibleOwnProducts = selectableOwnProducts.filter(
    (p) => !counterOfferedProductIds.includes(p.id)
  );

  const orderedCounterpartyProducts = useMemo(() => {
    const initialSet = new Set(initialRequestedProductIds);
    return [...counterpartyProducts].sort((a, b) => {
      const aInitial = initialSet.has(a.id) ? 1 : 0;
      const bInitial = initialSet.has(b.id) ? 1 : 0;
      return bInitial - aInitial;
    });
  }, [counterpartyProducts, initialRequestedProductIds]);

  const selectableCounterpartyProducts = orderedCounterpartyProducts.filter(
    (p) => !counterVisibleProductIds.includes(p.id)
  );

  const sameIdList = (left: string[], right: string[]) => {
    if (left.length !== right.length) {
      return false;
    }

    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();
    return leftSorted.every((id, idx) => id === rightSorted[idx]);
  };

  useEffect(() => {
    if (loading || offeredTouched) {
      return;
    }

    if (!sameIdList(counterOfferedProductIds, initialOfferedProductIds)) {
      setCounterOfferedProductIds(initialOfferedProductIds);
    }
  }, [counterOfferedProductIds, initialOfferedProductIds, loading, offeredTouched]);

  useEffect(() => {
    // Keep server-driven defaults in sync only before user starts editing,
    // and freeze them while submit is in progress to avoid visual rollback.
    if (loading || visibleTouched) {
      return;
    }

    if (!sameIdList(counterVisibleProductIds, initialVisibleProductIds)) {
      setCounterVisibleProductIds(initialVisibleProductIds);
    }
  }, [counterVisibleProductIds, initialVisibleProductIds, loading, visibleTouched]);

  useEffect(() => {
    if (loading || requestedTouched) {
      return;
    }

    if (!sameIdList(counterRequestedProductIds, initialRequestedProductIds)) {
      setCounterRequestedProductIds(initialRequestedProductIds);
    }
  }, [counterRequestedProductIds, initialRequestedProductIds, loading, requestedTouched]);

  useEffect(() => {
    if (loading || amountTouched) {
      return;
    }

    const nextAmount =
      initialAmount != null && Number.isFinite(Number(initialAmount)) ? String(Number(initialAmount)) : "";
    if (counterAmount !== nextAmount) {
      setCounterAmount(nextAmount);
    }
  }, [amountTouched, counterAmount, initialAmount, loading]);

  useEffect(() => {
    if (!product.isFree && canUseProductMode && !includeMoney && !includeProduct) {
      setIncludeProduct(true);
    }
  }, [product.isFree, includeMoney, includeProduct, canUseProductMode]);

  useEffect(() => {
    if (canUseProductMode) {
      return;
    }

    setIncludeProduct(false);
    if (product.requestByMoney) {
      setIncludeMoney(true);
    }
  }, [canUseProductMode, product.requestByMoney]);

  const currentDraftAmount = wantsMoney
    ? (counterAmount.trim() !== "" ? `₹${counterAmount}` : "Not set")
    : "No money";
  const currentDraftListingCount = wantsProduct
    ? (canOfferOwnProducts ? counterOfferedProductIds.length : counterRequestedProductIds.length)
    : 0;
  const previousAmountValue = previousOffer?.amount != null ? Number(previousOffer.amount) : null;
  const previousListingCount = previousOffer?.productCount ?? 0;
  const amountChanged = previousOffer
    ? (previousAmountValue ?? null) !== (wantsMoney && counterAmount.trim() !== "" ? Number(counterAmount) : null)
    : false;
  const listingsChanged = previousOffer ? previousListingCount !== currentDraftListingCount : false;
  const changeHint = amountChanged || listingsChanged
    ? "You are editing your last offer."
    : "No changes from your previous offer yet.";

  // Comparison snapshot for offer negotiation
  const comparisonSnapshot = previousOffer ? (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        padding: 10,
        gap: 10,
        marginBottom: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: theme.colors.textPrimary }}>
          Previous Offer Snapshot
        </Text>
        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
          Compare your last submitted offer with this draft before you send.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceMuted,
            paddingVertical: 8,
            paddingHorizontal: 10,
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>Previous Amount</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.textPrimary }}>
            {previousAmountValue != null ? `₹${previousAmountValue}` : "No money"}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceMuted,
            paddingVertical: 8,
            paddingHorizontal: 10,
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>Previous Listings</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.textPrimary }}>
            {previousListingCount}
          </Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
          paddingVertical: 8,
          paddingHorizontal: 10,
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>This Draft</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.textPrimary }}>
          {currentDraftAmount} · {currentDraftListingCount} listing(s)
        </Text>
      </View>

      <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>{changeHint}</Text>
    </View>
  ) : null;

  // Empty state content for when user has no products
  const noProductsContent = canOfferOwnProducts && selectableOwnProducts.length === 0 ? (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.textPrimary }}>No listings to offer yet.</Text>
      <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>Create a listing first to include it in this counter offer.</Text>
      {(onGoToMyListings || onCreateListing) ? (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
          {onGoToMyListings ? (
            <Button label="See listings" variant="ghost" onPress={onGoToMyListings} style={{ flex: 1 }} />
          ) : null}
          {onCreateListing ? (
            <Button label="Create listing" variant="ghost" onPress={onCreateListing} style={{ flex: 1 }} />
          ) : null}
        </View>
      ) : null}
    </View>
  ) : undefined;

  // Detect duplicate offer (same amount + same products as last offer by this user)
  const lastUserOffer = allOffers
    .filter((o) => o.offeredById === userId)
    .sort((a, b) => (b.id > a.id ? 1 : -1))[0]; // Sort descending to get newest
  
  const currentOfferInfo = {
    amount: wantsMoney && counterAmount.trim() ? Number(counterAmount) : null,
    productIds: wantsProduct
      ? (canOfferOwnProducts
        ? [...counterOfferedProductIds].sort()
        : [...counterRequestedProductIds].sort())
      : [],
  };

  const lastOfferInfo = lastUserOffer
    ? {
        amount: lastUserOffer.offeredAmount != null ? Number(lastUserOffer.offeredAmount) : null,
        productIds: (lastUserOffer.offeredProducts ?? []).map((p) => p.id).sort(),
      }
    : null;

  const isDuplicateOffer = lastOfferInfo != null && 
    currentOfferInfo.amount === lastOfferInfo.amount &&
    currentOfferInfo.productIds.length === lastOfferInfo.productIds.length &&
    currentOfferInfo.productIds.every((id, idx) => id === lastOfferInfo.productIds[idx]);

  const toggleCounterProduct = (productId: string) => {
    setOfferedTouched(true);
    setVisibleTouched(true);
    setRequestedTouched(true);
    setCounterOfferedProductIds((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((existingId) => existingId !== productId)
        : [...prev, productId];

      if (next.includes(productId)) {
        setCounterVisibleProductIds((visiblePrev) => visiblePrev.filter((existingId) => existingId !== productId));
        setCounterRequestedProductIds((requestedPrev) => requestedPrev.filter((existingId) => existingId !== productId));
      }

      return next;
    });
  };

  const toggleCounterVisibleProduct = (productId: string) => {
    setOfferedTouched(true);
    setVisibleTouched(true);
    setRequestedTouched(true);
    setCounterVisibleProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((existingId) => existingId !== productId);
      }

      setCounterOfferedProductIds((offeredPrev) => offeredPrev.filter((existingId) => existingId !== productId));
      setCounterRequestedProductIds((requestedPrev) => requestedPrev.filter((existingId) => existingId !== productId));
      return [...prev, productId];
    });
  };

  const toggleCounterRequestedProduct = (productId: string) => {
    setOfferedTouched(true);
    setVisibleTouched(true);
    setRequestedTouched(true);
    setCounterRequestedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((existingId) => existingId !== productId);
      }

      setCounterOfferedProductIds((offeredPrev) => offeredPrev.filter((existingId) => existingId !== productId));
      setCounterVisibleProductIds((visiblePrev) => visiblePrev.filter((existingId) => existingId !== productId));
      return [...prev, productId];
    });
  };

  const handleSubmit = async () => {
    setFeedback(null);

    const offerType: "PRODUCT" | "MONEY" | "MIXED" | "NONE" = includeMoney && includeProduct
      ? "MIXED"
      : includeMoney
        ? "MONEY"
        : includeProduct
          ? "PRODUCT"
          : "NONE";

    const payload: {
      offerType: "PRODUCT" | "MONEY" | "MIXED" | "NONE";
      offeredProducts?: string[];
      visibleProducts?: string[];
      requestedProducts?: string[];
      amount?: number;
      message?: string;
    } = {
      offerType,
      ...(counterMessage.trim() ? { message: counterMessage.trim() } : {}),
      ...(includeProduct && counterVisibleProductIds.length > 0
        ? { visibleProducts: counterVisibleProductIds }
        : {}),
      ...(includeProduct && counterRequestedProductIds.length > 0
        ? { requestedProducts: counterRequestedProductIds }
        : {}),
    };

    if (includeMoney) {
      const amountValue = Number(counterAmount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setFeedback("Enter a valid positive amount.");
        return;
      }
      payload.amount = amountValue;
    }

    if (includeProduct) {
      if (canOfferOwnProducts) {
        if (counterOfferedProductIds.length === 0) {
          setFeedback("Select one or more listings for your counter offer.");
          return;
        }
        payload.offeredProducts = counterOfferedProductIds;
      } else if (counterRequestedProductIds.length === 0) {
        setFeedback("Select one or more requester listings for this counter offer.");
        return;
      }
    }

    try {
      await onSubmit(payload);
      setFeedback(null);
    } catch (e: any) {
      setFeedback(e?.message || "Failed to submit counter offer.");
    }
  };

  const amountHelperText = isBuyer && effectiveMinAmount != null
    ? `Minimum expected: ₹${effectiveMinAmount}`
    : undefined;

  const amountWarningText = counterAmount
    ? Number.isFinite(parsedAmount)
      ? parsedAmount <= 0
        ? "Amount must be greater than zero"
        : isBelowMin
          ? `Below the minimum of ₹${effectiveMinAmount}. The seller may reject this offer.`
          : undefined
      : "Please enter a valid amount"
    : undefined;

  const selectedProductsHint = counterOfferedProductIds.length > 0
    ? `${counterOfferedProductIds.length} listing(s) selected.`
    : undefined;

  const duplicateOfferWarning = isDuplicateOffer
    ? "This counter offer is identical to your previous one. The seller may reject it again."
    : undefined;

  // Detect if there are significant changes from previous offer
  const hasSignificantChange = previousOffer && (
    (wantsMoney && counterAmount && Number(counterAmount) > Number(previousOffer.amount ?? 0)) ||
    (wantsProduct && counterOfferedProductIds.length !== (previousOffer.productCount ?? 0))
  );

  // Nudge for message when there are significant changes
  const messageNudge = hasSignificantChange && !counterMessage.trim()
    ? "Add a note explaining your updated offer to help the seller understand your reasoning."
    : undefined;

  return (
    <OfferComposerForm
      title="Create Counter Offer"
      showHeader={false}
      showModeSelector={!product.isFree && canCounter && canUseProductMode}
      subtitle={undefined}
      disabled={!canCounter}
      turnStatus={canCounter ? undefined : "WAITING"}
      supportsMixedOffers={supportsMixedOffers}
      includeMoney={includeMoney}
      includeProduct={includeProduct}
      moneyModeLabel="Money"
      productModeLabel="Product"
      includeProductFirst
      disableIncludeProductToggle={shouldDisableProductToggle}
      onDisableProductPress={() => {
        enqueueToast({
          title: "No listing available",
          message: "You need atleast one active listing to offer products in this counter offer. Please create a listing first.",
          variant: "warning",
          durationMs: 3500
        });
      }}
      onToggleIncludeMoney={() => {
        setIncludeMoney((prev) => {
          const next = !prev;
          if (!next && !includeProduct && !product.isFree) {
            setIncludeProduct(true);
          }
          return next;
        });
      }}
      onToggleIncludeProduct={() => {
        setIncludeProduct((prev) => {
          if (prev && !includeMoney) {
            return true;
          }
          return !prev;
        });
      }}
      showAmountField={showsAmountField}
      amountLabel="Offer amount"
      amount={counterAmount}
      onChangeAmount={(value) => {
        setAmountTouched(true);
        setCounterAmount(value);
      }}
      amountPlaceholder="Enter amount"
      amountHelperText={amountHelperText}
      amountWarningText={amountWarningText}
      showProductSelector={wantsProduct && canOfferOwnProducts}
      productSelectorLabel="Your listing to offer"
      offerableProducts={selectableOwnProducts}
      selectedProductIds={counterOfferedProductIds}
      onToggleProduct={toggleCounterProduct}
      selectedProductsHint={selectedProductsHint}
      noProductsContent={noProductsContent}
      showVisibleProductSelector={wantsProduct && canOfferOwnProducts}
      visibleProductSelectorLabel="Show for consideration"
      visibleProducts={visibleOwnProducts}
      selectedVisibleProductIds={counterVisibleProductIds}
      onToggleVisibleProduct={toggleCounterVisibleProduct}
      showRequestedProductSelector={wantsProduct && canRequestCounterpartyProducts}
      requestedProductSelectorLabel="Other products available from requester"
      requestedProducts={selectableCounterpartyProducts}
      requestedProductsOwner={requesterProfile}
      selectedRequestedProductIds={counterRequestedProductIds}
      onToggleRequestedProduct={toggleCounterRequestedProduct}
      comparisonSnapshot={comparisonSnapshot}
      message={counterMessage}
      onChangeMessage={setCounterMessage}
      warning={duplicateOfferWarning}
      warningColor="#b45309"
      nudge={messageNudge}
      feedback={feedback}
      feedbackColor={theme.colors.danger}
      submitLabel="Submit counter"
      submitLoading={loading}
      onSubmit={() => {
        void handleSubmit();
      }}
      onCancel={onCancel}
      cancelLabel="Cancel"
    />
  );
};
