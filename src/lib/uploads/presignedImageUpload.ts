import * as FileSystemLegacy from "expo-file-system/legacy";
import type { ImagePickerAsset } from "expo-image-picker";

export function mimeTypeFromFileName(fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export function toUploadErrorMessage(
  error: unknown,
  fallback: (error: unknown) => string,
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback(error);
}

export async function uploadImageAssetToPresignedUrl({
  asset,
  signedUrl,
  fileName,
}: {
  asset: ImagePickerAsset;
  signedUrl: string;
  fileName: string;
}) {
  const put = await FileSystemLegacy.uploadAsync(signedUrl, asset.uri, {
    httpMethod: "PUT",
    uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": mimeTypeFromFileName(fileName),
    },
  });

  if (put.status < 200 || put.status >= 300) {
    const bodyText = typeof put.body === "string" ? put.body : "";
    const suffix = bodyText ? ` ${bodyText.slice(0, 180)}` : "";
    throw new Error(`Image upload failed (${put.status}).${suffix}`);
  }
}