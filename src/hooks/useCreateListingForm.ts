import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import type { CreateProductInput } from "@barter/types";
import {
  CREATE_LISTING_RULES,
  validateCreateListingDraft,
  type CreateListingValidationResult,
} from "@barter/types";
import { useRouter } from "expo-router";
import { mobileApiClient } from "@/lib/api/client";
import {
  useCreateProductMutation,
  toErrorMessage,
} from "@/hooks/mutations/useCreateProductMutation";
import { reverseGeocodeCoords, useDeviceLocation } from "@/hooks/useDeviceLocation";
import {
  toUploadErrorMessage,
  uploadImageAssetToPresignedUrl,
} from "@/lib/uploads/presignedImageUpload";
import { useAppDialog } from "@/providers/AppDialogProvider";

interface UseCreateListingFormOptions {
  returnToProductId?: string;
}

export function useCreateListingForm(options?: UseCreateListingFormOptions) {
  const router = useRouter();
  const createMutation = useCreateProductMutation();
  const { requestLocation } = useDeviceLocation();
  const dialog = useAppDialog();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState<number | null>(null);
  const [manualLongitude, setManualLongitude] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [requestByMoney, setRequestByMoney] = useState(false);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fieldErrors, setFieldErrors] = useState<CreateListingValidationResult["fieldErrors"]>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

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

  const resetDraft = () => {
    setTitle("");
    setDescription("");
    setLocationName("");
    setUseManualLocation(false);
    setManualLatitude(null);
    setManualLongitude(null);
    setCategoryId("");
    setIsFree(false);
    setRequestByMoney(false);
    setImages([]);
    setFieldErrors({});
    setLocationWarning(null);
    setFormError(null);
    setIsUploadingImages(false);
  };

  const submit = async () => {
    setFormError(null);
    setLocationWarning(null);
    setFieldErrors({});

    if (manualLatitude == null || manualLongitude == null) {
      setLocationWarning("Please select your current location before publishing.");
      return;
    }

    const validation = validateCreateListingDraft({
      title,
      description,
      locationName,
      categoryId,
      isFree,
      requestByMoney,
      imageFileNames: images.map(
        (asset, index) => asset.fileName ?? `mobile-image-${index + 1}.jpg`,
      ),
    });

    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    try {
      const payload: CreateProductInput = { ...validation.normalized };

      // Location is mandatory for create listing at this stage.
      if (manualLatitude != null && manualLongitude != null) {
        payload.latitude = manualLatitude;
        payload.longitude = manualLongitude;
        if (!payload.locationName && locationName) {
          payload.locationName = locationName;
        }
      }

      const created = await createMutation.mutateAsync(payload);

      if (images.length > 0) {
        setIsUploadingImages(true);
        await uploadImages(created.id, images);
      }

      // Reset all fields after successful creation
      resetDraft();

      if (options?.returnToProductId) {
        router.replace({
          pathname: "/(app)/products/[id]",
          params: { id: options.returnToProductId, offeredProductId: created.id },
        });
      } else {
        router.replace(`/(app)/(tabs)/my-listings`);
      }
    } catch (error) {
      setFormError(toUploadErrorMessage(error, toErrorMessage));
    } finally {
      setIsUploadingImages(false);
    }
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

      setUseManualLocation(true);
      setManualLatitude(snapshot.latitude);
      setManualLongitude(snapshot.longitude);

      if (snapshot.locationName?.trim()) {
        setLocationName(snapshot.locationName);
        return true;
      }

      const fallbackName = await reverseGeocodeCoords(snapshot.latitude, snapshot.longitude);
      if (fallbackName) {
        setLocationName(fallbackName);
      }

      return true;
    } catch {
      setFormError("Unable to fetch current location. Please try again.");
      return false;
    } finally {
      setIsLocating(false);
    }
  };

  const setManualCoordinates = async (latitude: number, longitude: number) => {
    setUseManualLocation(true);
    setManualLatitude(latitude);
    setManualLongitude(longitude);
    // Reverse geocode the picked point so the name updates automatically
    const name = await reverseGeocodeCoords(latitude, longitude);
    if (name) {
      setLocationName(name);
    }
  };

  const pickImages = async () => {
    const source = await askImageSource();
    if (!source) {
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
        setImages((prev) => [...prev, ...result.assets].slice(0, CREATE_LISTING_RULES.MAX_IMAGES));
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
      selectionLimit: CREATE_LISTING_RULES.MAX_IMAGES,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, CREATE_LISTING_RULES.MAX_IMAGES));
    }
  };

  const removeImageAt = (index: number) => {
    setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  };

  return {
    rules: CREATE_LISTING_RULES,
    state: {
      title,
      description,
      locationName,
      useManualLocation,
      manualLatitude,
      manualLongitude,
      categoryId,
      isFree,
      requestByMoney,
      images,
      fieldErrors,
      locationWarning,
      formError,
      isLocating,
      isSubmitting: createMutation.isPending || isUploadingImages,
    },
    actions: {
      setTitle,
      setDescription,
      attachCurrentLocation,
      setManualCoordinates,
      clearManualCoordinates: () => {
        setLocationWarning(null);
        setUseManualLocation(false);
        setManualLatitude(null);
        setManualLongitude(null);
        setLocationName("");
      },
      setCategoryId,
      setIsFree,
      setRequestByMoney,
      submit,
      pickImages,
      removeImageAt,
      resetDraft,
      cancel: () => router.back(),
    },
  };
}

async function uploadImages(productId: string, assets: ImagePicker.ImagePickerAsset[]) {
  const limitedImages = assets.slice(0, CREATE_LISTING_RULES.MAX_IMAGES);
  const fileNames = limitedImages.map(
    (asset, index) => asset.fileName ?? `mobile-image-${index + 1}.jpg`,
  );

  const presignedEnvelope = await mobileApiClient.generateProductImageUploadUrls(
    productId,
    fileNames,
  );
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
      isPrimary: index === 0,
    })),
  );
}
