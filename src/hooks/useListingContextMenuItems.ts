import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ProductSummary } from "@barter/types";
import type { AnchoredContextMenuItem } from "@/components/ui/AnchoredContextMenu";
import { useDeleteProductMutation, toErrorMessage } from "@/hooks/mutations/useDeleteProductMutation";
import {
  toErrorMessage as toRelistErrorMessage,
  useRelistProductMutation,
} from "@/hooks/mutations/useRelistProductMutation";
import {
  toErrorMessage as toUnlistErrorMessage,
  useUnlistProductMutation,
} from "@/hooks/mutations/useUnlistProductMutation";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { useListingImagePreparationStore } from "@/lib/forms/listingImagePreparationStore";
import { uploadImages as uploadProductImages } from "@/lib/forms/listingFormUtils";
import { mobileApiClient } from "@/lib/api/client";
import { syncProductEntity } from "@/lib/query/mutationSync";
import { toUploadErrorMessage } from "@/lib/uploads/presignedImageUpload";
import { isProductReportedAboveThreshold } from "@/lib/listings/productReportThreshold";

interface UseListingContextMenuItemsOptions {
  /**
   * The product to build menu items for. Pass `null` when no product is
   * selected (e.g. before the context menu opens) — the hook returns an
   * empty array in that case.
   */
  product: ProductSummary | null;
  /**
   * Where to navigate back to after a successful "Edit" action.
   * Matches the `returnTo` param accepted by the edit screen.
   */
  returnTo?: "my-listings" | string;
  /**
   * Called after a delete, unlist, or relist mutation completes successfully.
   * Use this to navigate away from the detail screen — e.g. `router.replace`
   * to My Listings — so the user isn't left on a stale product page.
   * Not needed in MyListingsScreen (the list refreshes in place).
   */
  onMutationSuccess?: () => void;
}

interface UseListingContextMenuItemsResult {
  /** Items ready to pass to `AnchoredContextMenu` or `MenuHeader`. */
  items: AnchoredContextMenuItem[];
  /** `true` while a delete mutation is in flight for this product. */
  isDeleting: boolean;
  /** `true` while a relist mutation is in flight for this product. */
  isRelisting: boolean;
  /** `true` while an unlist mutation is in flight for this product. */
  isUnlisting: boolean;
  /** `true` while an image-upload retry is in flight for this product. */
  isRetryingUpload: boolean;
}

/**
 * Builds the context-menu items for a single listing (Edit / Unlist / Relist /
 * Delete / Retry image upload).  Encapsulates all mutation state so the same
 * behaviour is available in both `MyListingsScreen` and `ProductDetailScreen`
 * without duplicating logic.
 *
 * Usage
 * ─────
 * ```tsx
 * const { items } = useListingContextMenuItems({ product, returnTo: "my-listings" });
 *
 * <AnchoredContextMenu items={items} ... />
 * // — or —
 * <MenuHeader contextMenuItems={items} ... />
 * ```
 */
export function useListingContextMenuItems({
  product,
  returnTo,
  onMutationSuccess,
}: UseListingContextMenuItemsOptions): UseListingContextMenuItemsResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dialog = useAppDialog();

  const deleteMutation = useDeleteProductMutation();
  const relistMutation = useRelistProductMutation();
  const unlistMutation = useUnlistProductMutation();

  const pendingByProductId = useListingImagePreparationStore((s) => s.pendingByProductId);
  const markPreparing = useListingImagePreparationStore((s) => s.markPreparing);
  const markActivating = useListingImagePreparationStore((s) => s.markActivating);
  const markFailed = useListingImagePreparationStore((s) => s.markFailed);
  const clearPreparing = useListingImagePreparationStore((s) => s.clearPreparing);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [unlistingId, setUnlistingId] = useState<string | null>(null);
  const [retryingUploadId, setRetryingUploadId] = useState<string | null>(null);

  const productId = product?.id ?? null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const onDelete = (id: string) => {
    void (async () => {
      const shouldDelete = await dialog.confirm(
        "Delete listing",
        "Delete this listing permanently? This action cannot be undone.",
        { confirmLabel: "Delete", cancelLabel: "Cancel", destructive: true },
      );
      if (!shouldDelete) return;

      onMutationSuccess?.();
      setDeletingId(id);
      deleteMutation
        .mutateAsync(id)
        .catch((error) => {
          void dialog.alert("Delete failed", toErrorMessage(error));
        })
        .finally(() => {
          setDeletingId(null);
        });
    })();
  };

  const onUnlist = (id: string) => {
    void (async () => {
      const shouldUnlist = await dialog.confirm(
        "Unlist product",
        "Remove this listing from the marketplace? You can relist it later.",
        { confirmLabel: "Unlist", cancelLabel: "Cancel", destructive: true },
      );
      if (!shouldUnlist) return;

    //   onMutationSuccess?.();
      setUnlistingId(id);
      unlistMutation
        .mutateAsync(id)
        .catch((error) => {
          void dialog.alert("Unlist failed", toUnlistErrorMessage(error));
        })
        .finally(() => {
          setUnlistingId(null);
        });
    })();
  };

  const onRelist = (id: string) => {
    void (async () => {
      const shouldRelist = await dialog.confirm(
        "Relist product",
        "Relist this product? It will become ACTIVE and visible to buyers.",
        { confirmLabel: "Relist", cancelLabel: "Cancel" },
      );
      if (!shouldRelist) return;

    //   onMutationSuccess?.();
      setRelistingId(id);
      relistMutation
        .mutateAsync(id)
        .catch((error) => {
          void dialog.alert("Relist failed", toRelistErrorMessage(error));
        })
        .finally(() => {
          setRelistingId(null);
        });
    })();
  };

  const onRetryImageUpload = (id: string) => {
    if (retryingUploadId === id) return;

    const prepState = pendingByProductId[id];
    const retryAssets = prepState?.retryAssets ?? [];

    if (retryAssets.length === 0) {
      void dialog.alert(
        "Retry unavailable",
        "The original local image is no longer available. Open Edit and add image again.",
      );
      return;
    }

    setRetryingUploadId(id);
    markPreparing(id, prepState?.localPreviewUri ?? retryAssets[0]?.uri ?? null, retryAssets);

    void (async () => {
      try {
        await uploadProductImages(id, retryAssets, (index) => index === 0);
        markActivating(id);

        const relistedEnvelope = await mobileApiClient.relistProduct(id);
        if (relistedEnvelope.data) {
          syncProductEntity(queryClient, relistedEnvelope.data);
        } else {
          const refreshed = await mobileApiClient.getProductById(id);
          if (refreshed.data) {
            syncProductEntity(queryClient, refreshed.data);
          }
        }

        clearPreparing(id);
      } catch (error) {
        markFailed(id);
        void dialog.alert("Retry failed", toUploadErrorMessage(error, toRelistErrorMessage));
      } finally {
        setRetryingUploadId((current) => (current === id ? null : current));
      }
    })();
  };

  // ── Build items ─────────────────────────────────────────────────────────────

  const items = useMemo<AnchoredContextMenuItem[]>(() => {
    if (!product || !productId) return [];

    const prepState = pendingByProductId[productId];
    const canRetryUpload = prepState?.phase === "failed";
    const isReported = isProductReportedAboveThreshold(product);

    const result: AnchoredContextMenuItem[] = [];

    if (canRetryUpload) {
      result.push({
        key: "retry-image-upload",
        label:
          retryingUploadId === productId
            ? "Retrying image upload..."
            : "Retry image upload",
        icon: "refresh-cw",
        onPress: () => onRetryImageUpload(productId),
      });
    }

    result.push({
      key: "edit",
      label: "Edit",
      icon: "edit",
      onPress: () => {
        router.push({
          pathname: "/(app)/listings/[id]/edit",
          params: {
            id: productId,
            ...(returnTo ? { returnTo } : {}),
          },
        });
      },
    });

    if (!isReported) {
      result.push({
        key: "toggle-listing",
        label: product.status === "ACTIVE" ? "Unlist" : "Relist",
        icon: product.status === "ACTIVE" ? "eye-off" : "eye",
        onPress: () => {
          if (product.status === "ACTIVE") {
            onUnlist(productId);
          } else {
            onRelist(productId);
          }
        },
      });
    }

    result.push({
      key: "delete",
      label: "Delete",
      icon: "trash-2",
      destructive: true,
      dividerTop: true,
      onPress: () => onDelete(productId),
    });

    return result;
  }, [
    product,
    productId,
    pendingByProductId,
    retryingUploadId,
    returnTo,
    router,
  ]);

  return {
    items,
    isDeleting: deletingId === productId,
    isRelisting: relistingId === productId,
    isUnlisting: unlistingId === productId,
    isRetryingUpload: retryingUploadId === productId,
  };
}