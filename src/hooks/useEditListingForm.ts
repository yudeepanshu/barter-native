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
import {
  toUploadErrorMessage,
  uploadImageAssetToPresignedUrl,
} from "@/lib/uploads/presignedImageUpload";
import { reverseGeocodeCoords, useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useAppDialog } from "@/providers/AppDialogProvider";

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
  const [existingImages, setExistingImages] = useState<ProductImage[]>(() => product.productImages ?? []);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fieldErrors, setFieldErrors] = useState<CreateListingValidationResult["fieldErrors"]>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const askImageSource = async (): Promise<"camera" | "library" | null> => {
    const action = await dialog.show({
      title: "Choose image source",
      message: "Select how you want to add images.",
      actions: [
        { key: "camera", label: "Camera" },
        { key: "library", label: "Gallery" },
        { key: "cancel", label: "Cancel", role: "cancel" },
      ],
    });

    if (action === "camera" || action === "library") {
      return action;
    }

    return null;
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
          await uploadImages(product.id, newImages, existingImages.length > 0);
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

  const pickImages = async () => {
    const source = await askImageSource();
    if (!source) {
      return;
    }

    const remainingSlots = CREATE_LISTING_RULES.MAX_IMAGES - (existingImages.length + newImages.length);
    if (remainingSlots <= 0) {
      setFieldErrors((prev) => ({
        ...prev,
        images: `You can upload up to ${CREATE_LISTING_RULES.MAX_IMAGES} images`,
      }));
      return;
    }

    if (source === "camera") {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        setFormError("Camera permission is required to capture photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setNewImages((prev) => [...prev, ...result.assets].slice(0, prev.length + remainingSlots));
        setFieldErrors((prev) => ({ ...prev, images: undefined }));
      }
      return;
    }

    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaPermission.granted) {
      setFormError("Media library permission is required to choose images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewImages((prev) => [...prev, ...result.assets].slice(0, prev.length + remainingSlots));
      setFieldErrors((prev) => ({ ...prev, images: undefined }));
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
        setFormError("Unable to get a location accurate within 50m. Check permission, move to an open area, and refresh.");
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
      setFormError("Unable to fetch current location. Please try again.");
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
      setTitle,
      setDescription,
      attachCurrentLocation,
      clearManualCoordinates,
      setCategoryId,
      setIsFree,
      setRequestByMoney,
      setFormError,
      pickImages,
      removeExistingImage,
      removeNewImageAt,
      submit,
      cancel: () => router.back(),
    },
  };
}

async function uploadImages(
  productId: string,
  assets: ImagePicker.ImagePickerAsset[],
  hasExistingImages: boolean,
) {
  const limitedImages = assets.slice(0, CREATE_LISTING_RULES.MAX_IMAGES);
  const fileNames = limitedImages.map(
    (asset, index) => asset.fileName ?? `mobile-image-${index + 1}.jpg`,
  );

  const presignedEnvelope = await mobileApiClient.generateProductImageUploadUrls(productId, fileNames);
  const uploads = presignedEnvelope.data ?? [];

  if (uploads.length !== limitedImages.length) {
    throw new Error("Upload URL generation failed");
  }

  await Promise.all(
    uploads.map(async (upload, index) => {
      const asset = limitedImages[index];
      const fileName = fileNames[index];

      await uploadImageAssetToPresignedUrl({
        asset,
        signedUrl: upload.signedUrl,
        fileName,
      });
    }),
  );

  await mobileApiClient.addProductImages(
    productId,
    uploads.map((upload, index) => ({
      storageKey: upload.storageKey,
      url: upload.publicUrl,
      isPrimary: !hasExistingImages && index === 0,
    })),
  );
}

function buildUpdatePayload(
  product: ProductSummary,
  normalized: {
    title: string;
    description?: string;
    categoryId?: string;
    requestByMoney?: boolean;
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

  return payload;
}
