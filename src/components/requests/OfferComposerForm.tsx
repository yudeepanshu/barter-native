import React from "react";
import { Pressable ,StyleSheet, Text, View } from "react-native";
import type { ProductSummary } from "@barter/types";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Button } from "@/components/ui/Button";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SelectableProductGrid } from "@/components/requests/SelectableProductGrid";
import { Spinner } from "../ui/Spinner";

interface OfferComposerFormProps {
  title: string;
  subtitle?: string;
  showHeader?: boolean;
  showModeSelector?: boolean;
  disabled?: boolean;
  turnStatus?: "WAITING" | "ERROR";
  supportsMixedOffers: boolean;
  supportOnlyMoneyOffers?: boolean;
  includeMoney: boolean;
  includeProduct: boolean;
  moneyModeLabel?: string;
  productModeLabel?: string;
  includeProductFirst?: boolean;
  disableIncludeProductToggle?: boolean;
  onDisableProductPress?: () => void;
  onToggleIncludeMoney: () => void;
  onToggleIncludeProduct: () => void;
  showAmountField: boolean;
  amountLabel: string;
  amount: string;
  onChangeAmount: (value: string) => void;
  amountPlaceholder?: string;
  amountHelperText?: string;
  amountWarningText?: string;
  showProductSelector: boolean;
  productSelectorLabel: string;
  offerableProducts: ProductSummary[];
  selectedProductIds: string[];
  onToggleProduct: (productId: string) => void;
  selectedProductsHint?: string;
  noProductsContent?: React.ReactNode;
  loadingProductsText?: string;
  showVisibleProductSelector?: boolean;
  visibleProductSelectorLabel?: string;
  visibleProducts?: ProductSummary[];
  selectedVisibleProductIds?: string[];
  onToggleVisibleProduct?: (productId: string) => void;
  showRequestedProductSelector?: boolean;
  requestedProductSelectorLabel?: string;
  requestedProducts?: ProductSummary[];
  requestedProductsOwner?: { userName: string; profilePicture?: string | null };
  selectedRequestedProductIds?: string[];
  onToggleRequestedProduct?: (productId: string) => void;
  comparisonSnapshot?: React.ReactNode;
  message: string;
  onChangeMessage: (value: string) => void;
  messageLabel?: string;
  messagePlaceholder?: string;
  feedback?: string | null;
  feedbackColor?: string;
  warning?: string | null;
  warningColor?: string;
  nudge?: string | null;
  nudgeColor?: string;
  submitLabel: string;
  submitLoading?: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

export const OfferComposerForm: React.FC<OfferComposerFormProps> = ({
  title,
  subtitle,
  showHeader = true,
  showModeSelector = true,
  disabled = false,
  turnStatus,
  supportsMixedOffers,
  supportOnlyMoneyOffers = false,
  includeMoney,
  includeProduct,
  moneyModeLabel = "Cash Offer",
  productModeLabel = "Trade Offer",
  includeProductFirst = false,
  disableIncludeProductToggle = false,
  onDisableProductPress,
  onToggleIncludeMoney,
  onToggleIncludeProduct,
  showAmountField,
  amountLabel,
  amount,
  onChangeAmount,
  amountPlaceholder,
  amountHelperText,
  amountWarningText,
  showProductSelector,
  productSelectorLabel,
  offerableProducts,
  selectedProductIds,
  onToggleProduct,
  selectedProductsHint,
  noProductsContent,
  loadingProductsText,
  showVisibleProductSelector,
  visibleProductSelectorLabel,
  visibleProducts = [],
  selectedVisibleProductIds = [],
  onToggleVisibleProduct,
  showRequestedProductSelector,
  requestedProductSelectorLabel,
  requestedProducts = [],
  requestedProductsOwner,
  selectedRequestedProductIds = [],
  onToggleRequestedProduct,
  comparisonSnapshot,
  message,
  onChangeMessage,
  messageLabel = "Message",
  messagePlaceholder,
  feedback,
  feedbackColor,
  warning,
  warningColor = "#f59e0b",
  nudge,
  nudgeColor = "#3b82f6",
  submitLabel,
  submitLoading,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      {showHeader ? (
        <>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
          {turnStatus === "WAITING" ? (
            <Text style={[styles.turnStatus, { color: theme.colors.textMuted }]}>Waiting for their response...</Text>
          ) : null}
        </>
      ) : null}

      {disabled && turnStatus === "WAITING" ? (
        <Text style={[styles.disabledMessage, { color: theme.colors.textMuted }]}>Your counter offer will be available once they respond.</Text>
      ) : (
        showModeSelector ? (
          <View style={styles.modeRow}>
          {supportOnlyMoneyOffers ? (
            <Text style={[styles.modeInfo, { color: theme.colors.textMuted }]}>This listing accepts cash offers only.</Text>
          ) : supportsMixedOffers ? (
            <>
              {includeProductFirst ? (
                <>
                  {disableIncludeProductToggle && onDisableProductPress ? (
                    <Pressable onPress={onDisableProductPress} style={styles.modeChip}>
                      <ToggleChip
                        label={productModeLabel}
                        selected={productModeLabel ? false : includeProduct}
                        style={{ flex: 1 }}
                        disabled={true}
                        onPress={onToggleIncludeProduct}
                      />
                    </Pressable>
                  ) : (
                    <ToggleChip
                      label={productModeLabel}
                      selected={includeProduct}
                      style={styles.modeChip}
                      onPress={onToggleIncludeProduct}
                      disabled={disableIncludeProductToggle}
                    />
                  )}
                  <ToggleChip
                    label={moneyModeLabel}
                    selected={includeMoney}
                    style={styles.modeChip}
                    onPress={onToggleIncludeMoney}
                  />
                </>
              ) : (
                <>
                  <ToggleChip
                    label={moneyModeLabel}
                    selected={includeMoney}
                    style={styles.modeChip}
                    onPress={onToggleIncludeMoney}
                  />
                  {disableIncludeProductToggle && onDisableProductPress ? (
                    <Pressable onPress={onDisableProductPress} style={styles.modeChip}>
                      <ToggleChip
                        label={productModeLabel}
                        selected={includeProduct}
                        style={{ flex: 1 }}
                        disabled={true}
                        onPress={onToggleIncludeProduct}
                      />
                    </Pressable>
                  ) : (
                    <ToggleChip
                      label={productModeLabel}
                      selected={includeProduct}
                      style={styles.modeChip}
                      onPress={onToggleIncludeProduct}
                      disabled={disableIncludeProductToggle}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <Text style={[styles.modeInfo, { color: theme.colors.textMuted }]}>This listing accepts trade offers only.</Text>
          )}
          </View>
        ) : null
      )}

      {comparisonSnapshot}

      {showAmountField ? (
        <View style={styles.moneyOfferWrap}>
          <CurrencyInput
            label={amountLabel}
            value={amount}
            onChange={onChangeAmount}
          />

          {amountHelperText ? (
            <View style={styles.minAmountHint}>
              {amountWarningText ? <Text style={[styles.minAmountWarning, { color: "#dc2626" }]}>{amountWarningText}</Text> : <Text style={[styles.minAmountLabel, { color: theme.colors.textMuted }]}>{amountHelperText}</Text>}
            </View>
          ) : null}
        </View>
      ) : null}

      {showProductSelector && !disableIncludeProductToggle ? (
        <View style={styles.offerWrap}>
          {offerableProducts.length > 0 ? (
            <Text style={[styles.offerLabel, { color: theme.colors.textSecondary }]}>{productSelectorLabel}</Text>
          ) : null}
          {offerableProducts.length > 0 ? (
            <>
              <SelectableProductGrid
                products={offerableProducts}
                selectedProductIds={selectedProductIds}
                onToggleProduct={onToggleProduct}
                emptyText="No listings available."
              />
              {selectedProductsHint ? (
                <Text style={[styles.offerHint, { color: theme.colors.textMuted }]}>{selectedProductsHint}</Text>
              ) : null}
            </>
          ) : (
            noProductsContent ?? null
          )}
          {loadingProductsText ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Spinner size={14} />
              <Text style={[styles.offerHint, { color: theme.colors.textMuted }]}>{loadingProductsText}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showVisibleProductSelector && !disableIncludeProductToggle && visibleProducts.length > 0 ? (
        <View style={styles.offerWrap}>
          <Text style={[styles.offerLabel, { color: theme.colors.textSecondary }]}>{visibleProductSelectorLabel ?? "Show for consideration (optional)"}</Text>
          <SelectableProductGrid
            products={visibleProducts}
            selectedProductIds={selectedVisibleProductIds}
            onToggleProduct={(productId) => onToggleVisibleProduct?.(productId)}
            emptyText="No additional listings available."
          />
        </View>
      ) : null}

      {showRequestedProductSelector ? (
        <View style={styles.offerWrap}>
          <Text style={[styles.offerLabel, { color: theme.colors.textSecondary }]}>{requestedProductSelectorLabel ?? "Request in return (optional)"}</Text>
          <SelectableProductGrid
            products={requestedProducts}
            selectedProductIds={selectedRequestedProductIds}
            onToggleProduct={(productId) => onToggleRequestedProduct?.(productId)}
            owner={requestedProductsOwner}
            emptyText="No products available from this request history yet."
          />
        </View>
      ) : null}

      {(offerableProducts.length > 0 || (selectedRequestedProductIds?.length ?? 0) > 0 || showRequestedProductSelector || includeMoney || supportOnlyMoneyOffers) ?
        <Input
          label={messageLabel}
          value={message}
          onChangeText={onChangeMessage}
          placeholder={messagePlaceholder}
          maxLength={60}
          showCharacterCount
      /> : null}

      {warning ? (
        <Text style={[styles.warning, { color: warningColor }]}>{warning}</Text>
      ) : null}

      {nudge ? (
        <Text style={[styles.nudge, { color: nudgeColor }]}>{nudge}</Text>
      ) : null}

      {feedback ? (
        <Text style={[styles.feedback, { color: feedbackColor ?? theme.colors.textSecondary }]}>{feedback}</Text>
      ) : null}

      <Button
        label={submitLabel}
        loading={submitLoading}
        onPress={onSubmit}
        disabled={
          disabled ||
          (supportOnlyMoneyOffers
            ? amount.trim() === ""
            : (offerableProducts.length === 0 && includeProduct && (selectedRequestedProductIds?.length ?? 0) === 0) ||
              (includeMoney && amount.trim() === "") ||
              (includeProduct && selectedProductIds.length === 0 && (selectedRequestedProductIds?.length ?? 0) === 0))
        }
      />

      {onCancel ? <Button label={cancelLabel} variant="ghost" onPress={onCancel} disabled={disabled} /> : null}

    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  turnStatus: { fontSize: 12, fontStyle: "italic", marginTop: -4 },
  disabledMessage: { fontSize: 13, lineHeight: 18, marginVertical: 8 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeInfo: { fontSize: 13 },
  modeChip: { flex: 1, minWidth: 0 },
  moneyOfferWrap: { gap: 8 },
  minAmountHint: { gap: 4 },
  minAmountLabel: { fontSize: 12, fontWeight: "500" },
  minAmountWarning: { fontSize: 12, fontWeight: "600" },
  offerWrap: { gap: 8 },
  offerLabel: { fontSize: 13, fontWeight: "600" },
  offerList: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 8,
  },
  offerHint: { fontSize: 12 },
  warning: { fontSize: 13, fontWeight: "600", marginVertical: 6 },
  nudge: { fontSize: 12, fontWeight: "500", marginVertical: 4, fontStyle: "italic" },
  feedback: { fontSize: 13, fontStyle: "italic" },
});
