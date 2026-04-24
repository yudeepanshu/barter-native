import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  CREATE_LISTING_RULES,
  validateCreateListingDraft,
  type CreateListingValidationResult,
  type ProductImage,
  type ProductSummary,
  type UpdateProductInput,
} from "@barter/types";
import { useRouter } from "expo-router";
import { mobileApiClient } from "@/lib/api/client";
import {
  toErrorMessage,
  useUpdateProductMutation,
} from "@/hooks/mutations/useUpdateProductMutation";
import { toUploadErrorMessage } from "@/lib/uploads/presignedImageUpload";
import { reverseGeocodeCoords, useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useAppDialog } from "@/providers/AppDialogProvider";
import {
  pickListingImages,
  uploadImages as uploadProductImages,
  LISTING_FORM_ERRORS,
} from "@/lib/forms/listingFormUtils";
import {
  sanitizeDescriptionInput,
  sanitizeLocationNameInput,
  sanitizeMoneyInput,
  sanitizeTitleInput,
} from "@/lib/utils/inputSanitizer";

export function useEditListingForm(
  product: ProductSummary,
  options?: {
    returnTo?: "my-listings";
  },
) {
  const router = useRouter();
  const updateMutation = useUpdateProductMutation(product.id);
  const { requestLocation } = useDeviceLocation();
  const dialog = useAppDialog();

  const [title, setTitle] = useState(() => product.title ?? "");
  const [description, setDescription] = useState(() => product.description ?? "");
  const [locationName, setLocationName] = useState(() => product.locationName ?? "");
  const [manualLatitude, setManualLatitude] = useState<number | null>(() => product.latitude ?? null);
  const [manualLongitude, setManualLongitude] = useState<number | null>(() => product.longitude ?? null);
  const [categoryId, setCategoryId] = useState(() => product.categoryId ?? "");
  const [isFree, setIsFree] = useState(() => Boolean(product.isFree));
  const [requestByMoney, setRequestByMoney] = useState(() => Boolean(product.requestByMoney));
  const [minMoneyAmount, setMinMoneyAmount] = useState(() =>
    product.minMoneyAmount != null ? String(product.minMoneyAmount) : "",
  );
  const [existingImages, setExistingImages] = useState<ProductImage[]>(() => product.productImages ?? []);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fieldErrors, setFieldErrors] = useState<CreateListingValidationResult["fieldErrors"]>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const pickImages = async () => {
    const remainingSlots = CREATE_LISTING_RULES.MAX_IMAGES - (existingImages.length + newImages.length);
    if (remainingSlots <= 0) {
      setFieldErrors((prev) => ({
        ...prev,
        images: `You can upload up to ${CREATE_LISTING_RULES.MAX_IMAGES} images`,
      }));
      return;
    }

    const { assets, error } = await pickListingImages({ dialog, selectionLimit: remainingSlots, fallbackError: toErrorMessage });

    if (error) {
      setFormError(error);
      return;
    }

    if (assets.length > 0) {
      setFormError(null);
      setNewImages((prev) => [...prev, ...assets].slice(0, prev.length + remainingSlots));
      setFieldErrors((prev) => ({ ...prev, images: undefined }));
    }
  };

  const submit = async () => {
    setFormError(null);
    setLocationWarning(null);
    setFieldErrors({});

    const effectiveImageCount = existingImages.length + newImages.length;
    const validation = validateCreateListingDraft({
      title,
      description,
      locationName,
      categoryId,
      isFree,
      requestByMoney,
      minMoneyAmount: requestByMoney
        ? (minMoneyAmount.trim().length > 0 ? Number(minMoneyAmount) : null)
        : null,
      imageFileNames: [
        ...Array.from({ length: existingImages.length }, (_, index) => `existing-image-${index + 1}.jpg`),
        ...newImages.map((asset, index) => asset.fileName ?? `mobile-image-${index + 1}.jpg`),
      ],
    });

    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    if (effectiveImageCount > CREATE_LISTING_RULES.MAX_IMAGES) {
      setFieldErrors({
        ...validation.fieldErrors,
        images: `You can upload up to ${CREATE_LISTING_RULES.MAX_IMAGES} images`,
      });
      return;
    }

    const payload = buildUpdatePayload(product, validation.normalized, {
      latitude: manualLatitude,
      longitude: manualLongitude,
    });
    const hasImageChanges = removedImageIds.length > 0 || newImages.length > 0;

    if (Object.keys(payload).length === 0 && !hasImageChanges) {
      if (options?.returnTo === "my-listings") {
        router.replace({
          pathname: "/(app)/products/[id]",
          params: { id: product.id, backTo: "my-listings" },
        });
      } else {
        router.push(`/(app)/products/${product.id}`);
      }
      return;
    }

    try {
      if (Object.keys(payload).length > 0) {
        await updateMutation.mutateAsync(payload);
      }

      if (hasImageChanges) {
        setIsUploadingImages(true);

        if (removedImageIds.length > 0) {
          await Promise.all(
            removedImageIds.map((imageId) => mobileApiClient.deleteProductImage(product.id, imageId)),
          );
        }

        if (newImages.length > 0) {
          await uploadProductImages(
            product.id,
            newImages,
            (index) => !existingImages.length && index === 0,
          );
        }
      }

      if (options?.returnTo === "my-listings") {
        router.replace({
          pathname: "/(app)/products/[id]",
          params: { id: product.id, backTo: "my-listings" },
        });
      } else {
        router.replace(`/(app)/products/${product.id}`);
      }
    } catch (error) {
      setFormError(toUploadErrorMessage(error, toErrorMessage));
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeExistingImage = (imageId: string) => {
    setExistingImages((prev) => prev.filter((image) => image.id !== imageId));
    setRemovedImageIds((prev) => (prev.includes(imageId) ? prev : [...prev, imageId]));
  };

  const removeNewImageAt = (index: number) => {
    setNewImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  };

  const attachCurrentLocation = async () => {
    setLocationWarning(null);
    setFormError(null);
    setIsLocating(true);
    try {
      const snapshot = await requestLocation({ maxAccuracyMeters: 50 });
      if (!snapshot) {
        setFormError(LISTING_FORM_ERRORS.LOCATION_ACCURACY);
        return false;
      }

      setManualLatitude(snapshot.latitude);
      setManualLongitude(snapshot.longitude);

      if (snapshot.locationName?.trim()) {
        setLocationName(snapshot.locationName);
        setFieldErrors((prev) => ({ ...prev, locationName: undefined }));
        return true;
      }

      const fallbackName = await reverseGeocodeCoords(snapshot.latitude, snapshot.longitude);
      if (fallbackName) {
        setLocationName(fallbackName);
        setFieldErrors((prev) => ({ ...prev, locationName: undefined }));
      }

      return true;
    } catch {
      setFormError(LISTING_FORM_ERRORS.LOCATION_FETCH);
      return false;
    } finally {
      setIsLocating(false);
    }
  };

  const clearManualCoordinates = () => {
    setLocationWarning(null);
    setManualLatitude(null);
    setManualLongitude(null);
    setLocationName("");
    setFieldErrors((prev) => ({ ...prev, locationName: undefined }));
  };

  const setSanitizedTitle = (value: string) => setTitle(sanitizeTitleInput(value));
  const setSanitizedDescription = (value: string) => setDescription(sanitizeDescriptionInput(value));
  const setSanitizedLocationName = (value: string) => setLocationName(sanitizeLocationNameInput(value));
  const setSanitizedMinMoneyAmount = (value: string) => setMinMoneyAmount(sanitizeMoneyInput(value));

  return {
    rules: CREATE_LISTING_RULES,
    state: {
      title,
      description,
      locationName,
      manualLatitude,
      manualLongitude,
      categoryId,
      isFree,
      requestByMoney,
      minMoneyAmount,
      existingImages,
      newImages,
      fieldErrors,
      locationWarning,
      formError,
      isLocating,
      isSubmitting: updateMutation.isPending || isUploadingImages,
      hasInitialized: true,
    },
    actions: {
      setTitle: setSanitizedTitle,
      setDescription: setSanitizedDescription,
      attachCurrentLocation,
      clearManualCoordinates,
      setLocationName: setSanitizedLocationName,
      setCategoryId,
      setIsFree,
      setRequestByMoney,
      setMinMoneyAmount: setSanitizedMinMoneyAmount,
      setFormError,
      pickImages,
      removeExistingImage,
      removeNewImageAt,
      submit,
      cancel: () => router.back(),
    },
  };
}

function buildUpdatePayload(
  product: ProductSummary,
  normalized: {
    title: string;
    description?: string;
    categoryId?: string;
    requestByMoney?: boolean;
    minMoneyAmount?: number | null;
    isFree?: boolean;
    locationName?: string;
  },
  location: {
    latitude: number | null;
    longitude: number | null;
  },
): UpdateProductInput {
  const nextDescription = normalized.description ?? null;
  const nextLocation = normalized.locationName ?? null;
  const nextCategoryId = normalized.categoryId ?? null;
  const nextLatitude = location.latitude ?? null;
  const nextLongitude = location.longitude ?? null;
  const payload: UpdateProductInput = {};

  if (normalized.title !== product.title) {
    payload.title = normalized.title;
  }
  if ((product.description ?? null) !== nextDescription) {
    payload.description = nextDescription;
  }
  if ((product.locationName ?? null) !== nextLocation) {
    payload.locationName = nextLocation;
  }
  if ((product.latitude ?? null) !== nextLatitude) {
    payload.latitude = nextLatitude;
  }
  if ((product.longitude ?? null) !== nextLongitude) {
    payload.longitude = nextLongitude;
  }
  if ((product.categoryId ?? null) !== nextCategoryId) {
    payload.categoryId = nextCategoryId;
  }
  if (Boolean(normalized.isFree) !== Boolean(product.isFree)) {
    payload.isFree = Boolean(normalized.isFree);
  }
  if (Boolean(normalized.requestByMoney) !== Boolean(product.requestByMoney)) {
    payload.requestByMoney = Boolean(normalized.requestByMoney);
  }
  if (Boolean(normalized.requestByMoney)) {
    const nextMinAmount = normalized.minMoneyAmount ?? 0;
    if (Number(product.minMoneyAmount ?? 0) !== Number(nextMinAmount)) {
      payload.minMoneyAmount = nextMinAmount;
    }
  }

  return payload;
}
