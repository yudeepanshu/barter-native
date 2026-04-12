/**
 * Image validation utilities for upload constraints.
 * 
 * LEARNING NOTE: This module enforces size limits before upload to:
 * 1. Give user fast feedback on their device (no network wait).
 * 2. Prevent uploading huge files to S3.
 * 3. Fail fast on invalid dimensions.
 * 
 * We check BOTH asset metadata (width/height) AND file size on disk.
 */

import * as FileSystem from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";

/**
 * Image upload constraints.
 * These thresholds are set to balance UX (not too strict) with performance (not too large).
 */
export const IMAGE_CONSTRAINTS = {
  /**
   * Max file size per image: 5MB.
   * Reasoning: At typical 4G speeds (10 Mbps), 5MB = ~4 seconds to upload.
   *            Mobile users expect < 5s for single image. Larger = abandoned uploads.
   */
  MAX_FILE_SIZE_MB: 5,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB

  /**
   * Max image dimensions: 2400×2400 for thumbnails, 4800×4800 for detail.
   * Reasoning: Most phones are 1080-1440p max display. 2400px is 2x that (for retina/2x DPI).
   *            No user-facing benefit beyond 2400px on mobile. Server can resize if needed.
   */
  MAX_DIMENSIONS: 2400,

  /**
   * Min image dimensions: 200×200.
   * Reasoning: Placeholder/thumbnail visibility threshold.
   */
  MIN_DIMENSIONS: 200,

  /**
   * Compression quality for JPEG.
   * Reasoning: 75% quality is imperceptible on phones but saves ~30% file size vs 85%.
   */
  DEFAULT_QUALITY: 0.75,

  /**
   * Max total images per listing.
   */
  MAX_IMAGES: 5,
} as const;

/**
 * Validation error types for user-facing feedback.
 */
export const IMAGE_VALIDATION_ERRORS = {
  FILE_NOT_FOUND: "Could not access the image file. Try selecting again.",
  FILE_TOO_LARGE: `Image exceeds ${IMAGE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB limit. Try a smaller or lower-quality image.`,
  DIMENSIONS_TOO_SMALL: `Image is too small. Please use images at least ${IMAGE_CONSTRAINTS.MIN_DIMENSIONS}×${IMAGE_CONSTRAINTS.MIN_DIMENSIONS}px.`,
  DIMENSIONS_TOO_LARGE: `Image is too large. Max ${IMAGE_CONSTRAINTS.MAX_DIMENSIONS}×${IMAGE_CONSTRAINTS.MAX_DIMENSIONS}px. Use a smaller image or crop it.`,
  UNKNOWN_ERROR: "Could not validate image. Try selecting another one.",
} as const;

/**
 * Get the actual file size in bytes from an image asset.
 * 
 * WHY THIS MATTERS:
 * `expo-image-picker` returns asset metadata but NOT file size.
 * We must read the file system to get accurate byte count.
 * This is why we do it BEFORE sending to S3.
 */
export async function getImageFileSizeBytes(assetUri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(assetUri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }
    // fileInfo.size is in bytes
    return fileInfo.size || 0;
  } catch (error) {
    throw new Error(IMAGE_VALIDATION_ERRORS.FILE_NOT_FOUND);
  }
}

export interface ImageValidationResult {
  isValid: boolean;
  error: string | null;
  sizeMB: number;
}

/**
 * Validate a single image asset against all constraints.
 * 
 * HOW THIS WORKS:
 * 1. Check dimensions from picker metadata (fast, no I/O).
 * 2. Read file size from disk (one I/O operation).
 * 3. Return detailed result so UI can show specific feedback.
 * 
 * WHEN TO USE:
 * After user picks image, call this immediately. Show error inline before "Save" button is enabled.
 */
export async function validateImageAsset(
  asset: ImagePickerAsset,
): Promise<ImageValidationResult> {
  // Check 1: Dimensions from metadata (instant, no I/O)
  if (asset.width && asset.width < IMAGE_CONSTRAINTS.MIN_DIMENSIONS) {
    return {
      isValid: false,
      error: IMAGE_VALIDATION_ERRORS.DIMENSIONS_TOO_SMALL,
      sizeMB: 0,
    };
  }

  if (asset.height && asset.height < IMAGE_CONSTRAINTS.MIN_DIMENSIONS) {
    return {
      isValid: false,
      error: IMAGE_VALIDATION_ERRORS.DIMENSIONS_TOO_SMALL,
      sizeMB: 0,
    };
  }

  if (asset.width && asset.width > IMAGE_CONSTRAINTS.MAX_DIMENSIONS) {
    return {
      isValid: false,
      error: IMAGE_VALIDATION_ERRORS.DIMENSIONS_TOO_LARGE,
      sizeMB: 0,
    };
  }

  if (asset.height && asset.height > IMAGE_CONSTRAINTS.MAX_DIMENSIONS) {
    return {
      isValid: false,
      error: IMAGE_VALIDATION_ERRORS.DIMENSIONS_TOO_LARGE,
      sizeMB: 0,
    };
  }

  // Check 2: File size on disk (one I/O, but worth it)
  try {
    const fileSizeBytes = await getImageFileSizeBytes(asset.uri);
    const sizeMB = fileSizeBytes / (1024 * 1024);

    if (fileSizeBytes > IMAGE_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        error: IMAGE_VALIDATION_ERRORS.FILE_TOO_LARGE,
        sizeMB,
      };
    }

    // All checks passed!
    return {
      isValid: true,
      error: null,
      sizeMB,
    };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : IMAGE_VALIDATION_ERRORS.UNKNOWN_ERROR,
      sizeMB: 0,
    };
  }
}

/**
 * Validate a batch of images (for multi-select).
 * Returns validation results in the same order as input.
 */
export async function validateImageAssets(
  assets: ImagePickerAsset[],
): Promise<ImageValidationResult[]> {
  return Promise.all(assets.map((asset) => validateImageAsset(asset)));
}
