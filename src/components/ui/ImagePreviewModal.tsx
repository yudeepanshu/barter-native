import {
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
import { CustomScrollView } from "./CustomScrollView";

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
  const mainScrollRef = useRef<ScrollView>(null);
  const thumbScrollRef = useRef<ScrollView>(null);

  const THUMB_SIZE = 52;
  const THUMB_GAP = 6;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    setTimeout(() => {
      mainScrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
      const scrollTo = initialIndex * (THUMB_SIZE + THUMB_GAP) - width / 2 + THUMB_SIZE / 2;
      thumbScrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: false });
    }, 0);
  }, [visible, initialIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleThumbPress = (index: number) => {
    setActiveIndex(index);
    mainScrollRef.current?.scrollTo({ x: index * width, animated: true });
    // Center the selected thumb
    const scrollTo = index * (THUMB_SIZE + THUMB_GAP) - width / 2 + THUMB_SIZE / 2;
    thumbScrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: true });
  };

  const handleMainScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const clamped = Math.max(0, Math.min(nextIndex, images.length - 1));
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      const scrollTo = clamped * (THUMB_SIZE + THUMB_GAP) - width / 2 + THUMB_SIZE / 2;
      thumbScrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: true });
    }
  };

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
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={12}
        >
          <Feather name="x" size={20} color="#ffffff" />
        </Pressable>

        {/* Main image scroll */}
        <CustomScrollView
          ref={mainScrollRef}
          horizontal
          pagingEnabled
          snapToInterval={width}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMainScroll}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center" }}
        >
          {images.map((image) => (
            <View
              key={image.id}
              style={[styles.imageSlide, { width, height: height - 130 }]}
            >
              <AppImage
                uri={image.url}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
          ))}
        </CustomScrollView>

        {/* Thumbnail strip */}
        {images.length > 1 ? (
          <View style={styles.thumbBar}>
            <CustomScrollView
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
                  <AppImage
                    uri={image.url}
                    style={styles.thumbImage}
                  />
                </Pressable>
              ))}
            </CustomScrollView>
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
  imageSlide: {
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
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