import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
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
  checkProductCreationLimit,
  getProductCreationLimitMessage,
} from "@/lib/listings/productCreationLimit";
import { reverseGeocodeCoords, useDeviceLocation } from "@/hooks/useDeviceLocation";
import { toUploadErrorMessage } from "@/lib/uploads/presignedImageUpload";
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
import { useListingImagePreparationStore } from "@/lib/forms/listingImagePreparationStore";
import { syncProductEntity } from "@/lib/query/mutationSync";
import { mobileApiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/queryKeys";

interface UseCreateListingFormOptions {
  returnToProductId?: string;
}

export function useCreateListingForm(options?: UseCreateListingFormOptions) {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const createMutation = useCreateProductMutation();
  const { requestLocation } = useDeviceLocation();
  const dialog = useAppDialog();
  const markPreparing = useListingImagePreparationStore((state) => state.markPreparing);
  const markActivating = useListingImagePreparationStore((state) => state.markActivating);
  const markFailed = useListingImagePreparationStore((state) => state.markFailed);
  const clearPreparing = useListingImagePreparationStore((state) => state.clearPreparing);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState<number | null>(null);
  const [manualLongitude, setManualLongitude] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [requestByMoney, setRequestByMoney] = useState(true);
  const [allowTradeRequest, setAllowTradeRequest] = useState(false);
  const [minMoneyAmount, setMinMoneyAmount] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fieldErrors, setFieldErrors] = useState<CreateListingValidationResult["fieldErrors"]>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const pickImages = async () => {
    const {assets, error} = await pickListingImages({ dialog, selectionLimit: Math.max(0, CREATE_LISTING_RULES.MAX_IMAGES - images.length), fallbackError: toErrorMessage });

    if (error) {
      setFormError(error);
      return;
    }

    if (assets.length > 0) {
      setImages((prev) => [...prev, ...assets].slice(0, CREATE_LISTING_RULES.MAX_IMAGES));
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
    setRequestByMoney(true);
    setAllowTradeRequest(false);
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
        const atLimit = await checkProductCreationLimit(queryClient, session.user.id);
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
      allowTradeRequest,
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
      const payload: CreateProductInput = {
        ...validation.normalized,
        status: "INACTIVE",
        isListed: false,
      };

      // Location is mandatory for create listing at this stage.
      if (manualLatitude != null && manualLongitude != null) {
        payload.latitude = manualLatitude;
        payload.longitude = manualLongitude;
        if (!payload.locationName && locationName) {
          payload.locationName = locationName;
        }
      }

      const created = await createMutation.mutateAsync(payload);

      const myListingsKey = queryKeys.products.infinite({
        ownerId: session?.user.id,
        limit: 40,
      });

      queryClient.setQueryData(myListingsKey, (existing: any) => {
        if (!existing || !Array.isArray(existing.pages) || existing.pages.length === 0) {
          return {
            pages: [{ items: [created], nextCursor: null, hasMore: false }],
            pageParams: [null],
          };
        }

        const firstPage = existing.pages[0] ?? { items: [], nextCursor: null, hasMore: false };
        const alreadyExists = firstPage.items?.some((item: { id: string }) => item.id === created.id);
        if (alreadyExists) {
          return existing;
        }

        return {
          ...existing,
          pages: [
            {
              ...firstPage,
              items: [created, ...(firstPage.items ?? [])],
            },
            ...existing.pages.slice(1),
          ],
        };
      });

      if (images.length > 0) {
        const imagesToUpload = [...images];
        markPreparing(created.id, imagesToUpload[0]?.uri ?? null, imagesToUpload);

        void (async () => {
          try {
            await uploadProductImages(created.id, imagesToUpload, (index) => index === 0);
            markActivating(created.id);

            // Do not block the listing while publish-to-active is in flight.
            const relistedEnvelope = await mobileApiClient.relistProduct(created.id);
            if (relistedEnvelope.data) {
              syncProductEntity(queryClient, relistedEnvelope.data);
            } else {
              const refreshed = await mobileApiClient.getProductById(created.id);
              if (refreshed.data) {
                syncProductEntity(queryClient, refreshed.data);
              }
            }

            clearPreparing(created.id);
          } catch {
            markFailed(created.id);
            void dialog.alert(
              "Image upload failed",
              "Listing is saved as inactive. Add an image from Edit and relist to make it active.",
            );
          }
        })();
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
      useManualLocation,
      manualLatitude,
      manualLongitude,
      categoryId,
      isFree,
      requestByMoney,
      allowTradeRequest,
      minMoneyAmount,
      images,
      fieldErrors,
      locationWarning,
      formError,
      isLocating,
      isSubmitting: createMutation.isPending || isUploadingImages,
    },
    actions: {
      setTitle: setSanitizedTitle,
      setDescription: setSanitizedDescription,
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
      setAllowTradeRequest,
      setLocationName: setSanitizedLocationName,
      setMinMoneyAmount: setSanitizedMinMoneyAmount,
      submit,
      pickImages,
      removeImageAt,
      resetDraft,
      cancel: () => router.back(),
    },
  };
}
