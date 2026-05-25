import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStatus } from "@/hooks/useSession";
import { useStartupBannersStore } from "@/lib/ui/startupBannersStore";

const STORAGE_KEY = "flippe_startup_banners_dismissed_v1";
const { width, height } = Dimensions.get("window");
const SLIDE_WIDTH = width - 48;

// ─── Types ────────────────────────────────────────────────────────────────────

type Slide = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  accentBg: string;
};

type Tab = "seller" | "buyer";

// ─── Slide data ───────────────────────────────────────────────────────────────

const SELLER_SLIDES: Slide[] = [
  {
    title: "List in seconds",
    subtitle: "Create a listing with photos, title, price or trade options — anyone can sell or buy.",
    icon: "camera-plus-outline",
    accent: "#7C3AED",
    accentBg: "#EDE9FE",
  },
  {
    title: "Flexible pricing",
    subtitle: "Sellers choose cash, trade, both, or set the item free — you control offers.",
    icon: "tag-outline",
    accent: "#0EA5E9",
    accentBg: "#E0F2FE",
  },
  {
    title: "Manage with ease",
    subtitle: "Review incoming requests and accept, counter, or decline. Contact exchange only after accept.",
    icon: "check-decagram-outline",
    accent: "#10B981",
    accentBg: "#D1FAE5",
  },
];

const BUYER_SLIDES: Slide[] = [
  {
    title: "Find it nearby",
    subtitle: "Browse local listings, filter by category and distance, and create requests for items you like.",
    icon: "map-search-outline",
    accent: "#F59E0B",
    accentBg: "#FEF3C7",
  },
  {
    title: "Offer your way",
    subtitle: "Make offers with cash, trade, or both. Negotiate and accept when you agree.",
    icon: "handshake-outline",
    accent: "#EC4899",
    accentBg: "#FCE7F3",
  },
  {
    title: "Safe exchange",
    subtitle: "Items are reserved when accepted. Either party can request contact details to arrange exchange.",
    icon: "shield-check-outline",
    accent: "#10B981",
    accentBg: "#D1FAE5",
  },
];

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({ total, active, accent }: { total: number; active: number; accent: string }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            dotStyles.dot,
            i === active
              ? { backgroundColor: accent, width: 20 }
              : { backgroundColor: "#D1D5DB", width: 8 },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});

// ─── Single slide card ────────────────────────────────────────────────────────

function SlideCard({
  slide,
  entering,
  direction,
}: {
  slide: Slide;
  entering: boolean;
  direction: "forward" | "back";
}) {
  const translateX = useRef(
    new Animated.Value(direction === "forward" ? SLIDE_WIDTH : -SLIDE_WIDTH),
  ).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { theme } = useAppTheme();

  useEffect(() => {
    if (entering) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 260,
          mass: 0.9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: direction === "forward" ? -SLIDE_WIDTH : SLIDE_WIDTH,
          useNativeDriver: true,
          damping: 22,
          stiffness: 260,
          mass: 0.9,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [entering]);

  const iconBg = theme.mode === "dark" ? theme.colors.surfaceMuted : slide.accentBg;
  const iconColor = slide.accent || theme.colors.primary;

  return (
    <Animated.View
      style={[
        cardStyles.card,
        { transform: [{ translateX }], opacity, backgroundColor: theme.colors.surface },
      ]}
    >
      {/* Icon badge */}
      <View style={[cardStyles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={slide.icon} size={36} color={iconColor} />
      </View>

      <Text style={[cardStyles.title, { color: theme.colors.textPrimary }]}>{slide.title}</Text>
      <Text style={[cardStyles.subtitle, { color: theme.colors.textSecondary }]}>{slide.subtitle}</Text>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: SLIDE_WIDTH,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 4,
  },
});

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function TabPill({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const bg = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bg, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [active]);

  const bgColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: ["#F3F4F6", accent],
  });

  const textColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: ["#6B7280", "#FFFFFF"],
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[tabStyles.pill, { backgroundColor: bgColor }]}>
        <Animated.Text style={[tabStyles.label, { color: textColor }]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function StartupBanners() {
  const [visibleLocal, setVisibleLocal] = useState(false);
  const [tab, setTab] = useState<Tab>("seller");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [renderKey, setRenderKey] = useState(0); // forces remount on slide change

  const status = useAuthStatus();
  const { visible, open, close, persistOnClose } = useStartupBannersStore();
  const { theme } = useAppTheme();

  // Modal entrance animation
  const sheetY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const slides = tab === "seller" ? SELLER_SLIDES : BUYER_SLIDES;
  const slide = slides[index];

  // ── Auth-based auto-open ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (visible) {
        if (mounted) setVisibleLocal(true);
        return;
      }
      if (status !== "unauthenticated") return;
      try {
        const v = await SecureStore.getItemAsync(STORAGE_KEY);
        if (mounted && v !== "1") open({ persistOnClose: true });
      } catch {
        if (mounted) open({ persistOnClose: true });
      }
    })();
    return () => { mounted = false; };
  }, [status, visible, open]);

  // ── Sync store → local ──
  useEffect(() => {
    if (visible) {
      setVisibleLocal(true);
      // Slide sheet up
      Animated.parallel([
        Animated.spring(sheetY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 26,
          stiffness: 300,
          mass: 1,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide sheet down then hide — but only hide if store still says closed
      Animated.parallel([
        Animated.spring(sheetY, {
          toValue: height,
          useNativeDriver: true,
          damping: 30,
          stiffness: 340,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // If the store was reopened while the close animation ran, keep visible
        if (!useStartupBannersStore.getState().visible) {
          setVisibleLocal(false);
        }
      });
    }
  }, [visible]);

  const changeSlide = useCallback(
    (newIndex: number, dir: "forward" | "back") => {
      setDirection(dir);
      setIndex(newIndex);
      setRenderKey((k) => k + 1);
    },
    [],
  );

  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    setIndex(0);
    setDirection("forward");
    setRenderKey((k) => k + 1);
  }, []);

  const onNext = useCallback(() => {
    if (index < slides.length - 1) {
      changeSlide(index + 1, "forward");
    } else {
      onDismiss();
    }
  }, [index, slides.length]);

  const onBack = useCallback(() => {
    if (index > 0) changeSlide(index - 1, "back");
  }, [index]);

  const onDismiss = useCallback(async () => {
    try {
      if (persistOnClose) {
        await SecureStore.setItemAsync(STORAGE_KEY, "1");
      }
    } catch { /* ignore */ }
    close();
  }, [persistOnClose, close]);

  if (!visibleLocal) return null;

  const accent = slide.accent;
  const isLast = index === slides.length - 1;
  const mode = /* persistOnClose ? "full" : */ "sheet";

//   if (mode === "full") {
//     return (
//       <Modal animationType="slide" visible={visibleLocal} transparent={false} statusBarTranslucent>
//         <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20, paddingTop: Platform.OS === 'android' ? 48 : 56 }}>
//           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
//             <View style={{ width: 40 }} />
//             <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary }}>Welcome to Flippe</Text>
//             <Pressable onPress={onDismiss} hitSlop={8}>
//               <MaterialCommunityIcons name="close" size={22} color={theme.colors.textSecondary} />
//             </Pressable>
//           </View>

//           <View style={{ marginTop: 28, alignItems: 'center', flex: 1 }}>
//             <View style={{ marginBottom: 8 }}>
//               <TabPill label="For Sellers" active={tab === 'seller'} accent={SELLER_SLIDES[0].accent} onPress={() => switchTab('seller')} />
//             </View>
//             <View style={{ marginBottom: 12 }}>
//               <TabPill label="For Buyers" active={tab === 'buyer'} accent={BUYER_SLIDES[0].accent} onPress={() => switchTab('buyer')} />
//             </View>

//             <View style={{ width: SLIDE_WIDTH, alignItems: 'center' }}>
//               <SlideCard key={`${tab}-${index}-${renderKey}`} slide={slide} entering direction={direction} />
//             </View>

//             <View style={{ marginTop: 18 }}>
//               <Dots total={slides.length} active={index} accent={accent} />
//             </View>

//             <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 24 }}>
//               <Pressable onPress={onBack} disabled={index === 0} style={({ pressed }) => [{ opacity: index === 0 ? 0.4 : pressed ? 0.7 : 1 }]}>
//                 <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>Back</Text>
//               </Pressable>
//               <Pressable onPress={onNext} style={({ pressed }) => [{ backgroundColor: accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, opacity: pressed ? 0.88 : 1 }]}>
//                 <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 16 }}>{isLast ? 'Get started' : 'Next'}</Text>
//               </Pressable>
//             </View>

//             <Pressable onPress={onDismiss} style={{ marginTop: 16 }}>
//               <Text style={{ color: theme.colors.textMuted }}>Skip for now</Text>
//             </Pressable>
//           </View>
//         </View>
//       </Modal>
//     );
//   }

  return (
    <Modal animationType="none" visible={visibleLocal} transparent statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { backgroundColor: theme.colors.overlay, opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[s.sheet, { transform: [{ translateY: sheetY }], backgroundColor: theme.colors.surface }]}
      >
        {/* Drag handle */}
        <View style={[s.handle, { backgroundColor: theme.colors.surfaceMuted }]} />

        {/* Tab switcher */}
        <View style={[s.tabRow, { backgroundColor: theme.colors.surfaceMuted }]}>
          <TabPill
            label="For Sellers"
            active={tab === "seller"}
            accent={SELLER_SLIDES[0].accent}
            onPress={() => switchTab("seller")}
          />
          <TabPill
            label="For Buyers"
            active={tab === "buyer"}
            accent={BUYER_SLIDES[0].accent}
            onPress={() => switchTab("buyer")}
          />
        </View>

        {/* Slide */}
        <View style={s.slideClip}>
          <SlideCard
            key={`${tab}-${index}-${renderKey}`}
            slide={slide}
            entering
            direction={direction}
          />
        </View>

        {/* Dots */}
        <Dots total={slides.length} active={index} accent={accent} />

        {/* Controls */}
        <View style={s.controls}>
          {/* Back */}
          <Pressable
            onPress={onBack}
            disabled={index === 0}
            style={({ pressed }) => [
              s.backBtn,
              { opacity: index === 0 ? 0 : pressed ? 0.6 : 1, backgroundColor: theme.colors.surfaceMuted },
            ]}
            accessibilityLabel="Back"
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textSecondary} />
          </Pressable>

          {/* Next / Get started */}
          <Pressable
            onPress={onNext}
            style={({ pressed }) => [
              s.nextBtn,
              { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
            ]}
            accessibilityLabel={isLast ? "Get started" : "Next"}
          >
            {isLast ? (
              <Text style={[s.nextLabel, { color: theme.colors.onPrimary }]}>Get started</Text>
            ) : (
              <>
                <Text style={[s.nextLabel, { color: theme.colors.onPrimary }]}>Next</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color={theme.colors.onPrimary} style={{ marginLeft: 6 }} />
              </>
            )}
          </Pressable>
        </View>

        {/* Skip */}
        <Pressable onPress={onDismiss} style={s.skip} accessibilityLabel="Skip tour">
          <Text style={[s.skipLabel, { color: theme.colors.textMuted }]}>Skip for now</Text>
        </Pressable>

        {/* Bottom safe-area filler */}
        <View style={s.safeBottom} />
      </Animated.View>
    </Modal>
  );
}

// ─── Sheet & layout styles ────────────────────────────────────────────────────

const SHEET_RADIUS = 28;

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
    // shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 24 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 100,
    padding: 4,
    marginBottom: 36,
  },
  slideClip: {
    width: SLIDE_WIDTH,
    minHeight: 220,
    overflow: "hidden",
    marginBottom: 28,
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  nextLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  skip: {
    marginTop: 16,
    paddingVertical: 4,
  },
  skipLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  safeBottom: {
    height: Platform.OS === "ios" ? 24 : 16,
  },
});