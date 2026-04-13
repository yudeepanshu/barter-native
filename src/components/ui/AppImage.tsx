import { Image as ExpoImage, type ImageProps } from "expo-image";
import { memo } from "react";

export interface AppImageProps extends Omit<ImageProps, "source" | "recyclingKey"> {
  uri: string;
  recyclingKey?: string;
}

export const AppImage = memo(function AppImage({
  uri,
  cachePolicy = "memory-disk",
  contentFit = "cover",
  recyclingKey,
  transition = 100,
  ...rest
}: AppImageProps) {
  return (
    <ExpoImage
      {...rest}
      source={{ uri }}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      recyclingKey={recyclingKey ?? uri}
      transition={transition}
    />
  );
});