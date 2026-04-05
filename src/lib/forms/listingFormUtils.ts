import * as ImagePicker from "expo-image-picker";
import { CREATE_LISTING_RULES } from "@barter/types";
import { mobileApiClient } from "@/lib/api/client";
import {
  toUploadErrorMessage,
  uploadImageAssetToPresignedUrl,
} from "@/lib/uploads/presignedImageUpload";

/**
 * Image source dialog options
 */
export async function askImageSource(
  dialog: ReturnType<typeof import("@/providers/AppDialogProvider").useAppDialog>,
): Promise<"camera" | "library" | null> {
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
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  return permission.granted;
}

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}

/**
 * Launch camera to capture image
 */
export async function launchCamera(): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
}

/**
 * Launch image library to select images
 */
export async function launchImageLibrary(
  selectionLimit: number,
): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit,
    quality: 0.8,
  });
}

/**
 * Common error messages
 */
export const LISTING_FORM_ERRORS = {
  CAMERA_PERMISSION: "Camera permission is required to capture photos.",
  MEDIA_PERMISSION: "Media library permission is required to choose images.",
  LOCATION_ACCURACY: "Unable to get a location accurate within 50m. Check permission, move to an open area, and refresh.",
  LOCATION_FETCH: "Unable to fetch current location. Please try again.",
  LOCATION_REQUIRED: "Please select your current location before publishing.",
} as const;

/**
 * Get image file name from asset or generate a default one
 */
export function getImageFileName(asset: ImagePicker.ImagePickerAsset, index: number): string {
  return asset.fileName ?? `mobile-image-${index + 1}.jpg`;
}

/**
 * Upload images to presigned URLs and register them with the product
 * @param productId - Product ID to associate images with
 * @param assets - Image assets to upload
 * @param isPrimaryCalculator - Function to determine if an image should be primary (first one typically)
 */
export async function uploadImages(
  productId: string,
  assets: ImagePicker.ImagePickerAsset[],
  isPrimaryCalculator: (index: number) => boolean,
): Promise<void> {
  const limitedImages = assets.slice(0, CREATE_LISTING_RULES.MAX_IMAGES);
  const fileNames = limitedImages.map((asset, index) => getImageFileName(asset, index));

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
      isPrimary: isPrimaryCalculator(index),
    })),
  );
}
