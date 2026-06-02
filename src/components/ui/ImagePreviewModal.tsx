import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { useRef, useState, useEffect } from "react";
import { AppImage } from "@/components/ui/AppImage";
import { Feather } from "@expo/vector-icons";

interface ProductImage {
  id: string;
  url: string;
}

interface ImagePreviewModalProps {
  images: ProductImage[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function ImagePreviewModal({
  images,
  initialIndex = 0,
  visible,
  onClose,
}: ImagePreviewModalProps) {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const mainListRef = useRef<FlatList>(null);
  const thumbScrollRef = useRef<ScrollView>(null);

  const THUMB_BAR_HEIGHT = 80;
  const THUMB_SIZE = 52;
  const THUMB_GAP = 6;
  const IMAGE_HEIGHT = height - THUMB_BAR_HEIGHT;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    setTimeout(() => {
      mainListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      const scrollTo =
        initialIndex * (THUMB_SIZE + THUMB_GAP) - width / 2 + THUMB_SIZE / 2;
      thumbScrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: false });
    }, 50);
  }, [visible, initialIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleThumbPress = (index: number) => {
    setActiveIndex(index);
    mainListRef.current?.scrollToIndex({ index, animated: true });
    const scrollTo =
      index * (THUMB_SIZE + THUMB_GAP) - width / 2 + THUMB_SIZE / 2;
    thumbScrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: true });
  };

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const next = viewableItems[0].index;
        setActiveIndex(next);
        const scrollTo =
          next * (THUMB_SIZE + THUMB_GAP) - width / 2 + THUMB_SIZE / 2;
        thumbScrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: true });
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.overlay}>

        {/* Close button */}
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={20} color="#ffffff" />
        </Pressable>

        {/* Image area — fills all space above the thumb strip */}
        <View style={{ width, height: IMAGE_HEIGHT }}>
          <FlatList
            ref={mainListRef}
            data={images}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <View style={{ width, height: IMAGE_HEIGHT, alignItems: "center", justifyContent: "center" }}>
                <AppImage
                  uri={item.url}
                  style={{ width, height: IMAGE_HEIGHT }}
                  contentFit="contain"
                />
              </View>
            )}
          />
        </View>

        {/* Thumbnail strip */}
        {images.length > 1 ? (
          <View style={styles.thumbBar}>
            <ScrollView
              ref={thumbScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbContent}
            >
              {images.map((image, index) => (
                <Pressable
                  key={image.id}
                  onPress={() => handleThumbPress(index)}
                  style={[
                    styles.thumb,
                    { width: THUMB_SIZE, height: THUMB_SIZE },
                    index === activeIndex ? styles.thumbActive : styles.thumbInactive,
                  ]}
                >
                  <AppImage uri={image.url} style={styles.thumbImage} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.96)",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: 52,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBar: {
    height: 80,
    justifyContent: "center",
  },
  thumbContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: "center",
  },
  thumb: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
  },
  thumbActive: {
    borderColor: "#ffffff",
    opacity: 1,
  },
  thumbInactive: {
    borderColor: "transparent",
    opacity: 0.45,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
});
