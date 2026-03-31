import { useState } from "react";
import { Alert } from "react-native";
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
import { reverseGeocodeCoords } from "@/hooks/useDeviceLocation";
import {
  toUploadErrorMessage,
  uploadImageAssetToPresignedUrl,
} from "@/lib/uploads/presignedImageUpload";

export function useCreateListingForm() {
  const router = useRouter();
  const createMutation = useCreateProductMutation();

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
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const askImageSource = () =>
    new Promise<"camera" | "library" | null>((resolve) => {
      Alert.alert("Choose image source", "Select how you want to add images.", [
        { text: "Camera", onPress: () => resolve("camera") },
        { text: "Gallery", onPress: () => resolve("library") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    });

  const submit = async () => {
    setFormError(null);
    setFieldErrors({});

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

      // Location is optional — attach it when available
      if (useManualLocation && manualLatitude != null && manualLongitude != null) {
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
      setFormError(null);

      router.push(`/(app)/products/${created.id}`);
    } catch (error) {
      setFormError(toUploadErrorMessage(error, toErrorMessage));
    } finally {
      setIsUploadingImages(false);
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
      formError,
      isSubmitting: createMutation.isPending || isUploadingImages,
    },
    actions: {
      setTitle,
      setDescription,
      setManualCoordinates,
      clearManualCoordinates: () => {
        setManualLatitude(null);
        setManualLongitude(null);
      },
      setCategoryId,
      setIsFree,
      setRequestByMoney,
      submit,
      pickImages,
      cancel: () => {
        // Reset all fields before navigating back
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
        setFormError(null);
        setIsUploadingImages(false);
        router.back();
      },
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
