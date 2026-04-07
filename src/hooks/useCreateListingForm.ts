import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import type { CreateProductInput } from "@barter/types";
import {
  CREATE_LISTING_RULES,
  validateCreateListingDraft,
  type CreateListingValidationResult,
} from "@barter/types";
import { useRouter } from "expo-router";
import { useSession } from "@/hooks/useSession";
import {
  useCreateProductMutation,
  toErrorMessage,
} from "@/hooks/mutations/useCreateProductMutation";
import {
  MAX_PRODUCTS_PER_USER,
  getProductCreationLimitMessage,
  hasReachedProductCreationLimit,
} from "@/lib/listings/productCreationLimit";
import { reverseGeocodeCoords, useDeviceLocation } from "@/hooks/useDeviceLocation";
import { toUploadErrorMessage } from "@/lib/uploads/presignedImageUpload";
import { useAppDialog } from "@/providers/AppDialogProvider";
import {
  askImageSource,
  requestCameraPermission,
  requestMediaLibraryPermission,
  launchCamera,
  launchImageLibrary,
  uploadImages as uploadProductImages,
  LISTING_FORM_ERRORS,
} from "@/lib/forms/listingFormUtils";

interface UseCreateListingFormOptions {
  returnToProductId?: string;
}

export function useCreateListingForm(options?: UseCreateListingFormOptions) {
  const router = useRouter();
  const session = useSession();
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
  const [minMoneyAmount, setMinMoneyAmount] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fieldErrors, setFieldErrors] = useState<CreateListingValidationResult["fieldErrors"]>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const pickImages = async () => {
    const source = await askImageSource(dialog);
    if (!source) {
      return;
    }

    if (source === "camera") {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        setFormError(LISTING_FORM_ERRORS.CAMERA_PERMISSION);
        return;
      }

      const result = await launchCamera();
      if (!result.canceled && result.assets.length > 0) {
        setImages((prev) => [...prev, ...result.assets].slice(0, CREATE_LISTING_RULES.MAX_IMAGES));
      }
      return;
    }

    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      setFormError(LISTING_FORM_ERRORS.MEDIA_PERMISSION);
      return;
    }

    const result = await launchImageLibrary(CREATE_LISTING_RULES.MAX_IMAGES);
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, CREATE_LISTING_RULES.MAX_IMAGES));
    }
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
    setMinMoneyAmount("");
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
      setLocationWarning(LISTING_FORM_ERRORS.LOCATION_REQUIRED);
      return;
    }

    if (session?.user.id) {
      try {
        const atLimit = await hasReachedProductCreationLimit(session.user.id);
        if (atLimit) {
          setFormError(getProductCreationLimitMessage(MAX_PRODUCTS_PER_USER));
          return;
        }
      } catch {
        // If pre-check fails (network/transient), backend still enforces the hard limit.
      }
    }

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
        await uploadProductImages(created.id, images, (index) => index === 0);
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
        setFormError(LISTING_FORM_ERRORS.LOCATION_ACCURACY);
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
      setFormError(LISTING_FORM_ERRORS.LOCATION_FETCH);
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
      minMoneyAmount,
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
      setMinMoneyAmount,
      submit,
      pickImages,
      removeImageAt,
      resetDraft,
      cancel: () => router.back(),
    },
  };
}
