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
    subtitle: "Snap photos, add a title and description, pick a category, and post. Your item goes live instantly to nearby buyers.",
    icon: "camera-plus-outline",
    accent: "#7C3AED",
    accentBg: "#EDE9FE",
  },
  {
    title: "You set the terms",
    subtitle: "Accept cash, trade for other items, both, or give it away for free. Full control over how you want to deal.",
    icon: "tag-outline",
    accent: "#0EA5E9",
    accentBg: "#E0F2FE",
  },
  {
    title: "Manage offers easily",
    subtitle: "Review incoming requests, counter-offer, accept or decline. Contact details are only shared when you accept an offer, that also after approval.",
    icon: "check-decagram-outline",
    accent: "#10B981",
    accentBg: "#D1FAE5",
  },
  {
    title: "Buyers can sell too",
    subtitle: "Every account works both ways. Switch between buying and selling anytime — no separate accounts, no restrictions.",
    icon: "swap-horizontal-circle-outline",
    accent: "#6366F1",
    accentBg: "#EEF2FF",
  },
  {
    title: "Cash stays between you",
    subtitle: "Flippe doesn't handle payments. Money, trades, or freebies. All settled directly between you and the other person, your way.",
    icon: "hand-coin-outline",
    accent: "#D97706",
    accentBg: "#FEF3C7",
  },
];

const BUYER_SLIDES: Slide[] = [
  {
    title: "Discover nearby",
    subtitle: "Browse listings around you, filter by category and distance, find exactly what you need or just explore what's out there.",
    icon: "map-search-outline",
    accent: "#F59E0B",
    accentBg: "#FEF3C7",
  },
  {
    title: "Offer your way",
    subtitle: "Send cash offers, propose trades with your own items, or mix both. Negotiate with sellers until you strike the perfect deal.",
    icon: "handshake-outline",
    accent: "#EC4899",
    accentBg: "#FCE7F3",
  },
  {
    title: "Safe & verified exchange",
    subtitle: "Accepted items are reserved for you. Request contact details and verify the handoff in person with secure one time code.",
    icon: "shield-check-outline",
    accent: "#10B981",
    accentBg: "#D1FAE5",
  },
  {
    title: "Sellers can buy too",
    subtitle: "Your account works both ways. Browse and make offers as a buyer, list your own items as a seller — all from the same place.",
    icon: "swap-horizontal-circle-outline",
    accent: "#6366F1",
    accentBg: "#EEF2FF",
  },
  {
    title: "Cash stays between you",
    subtitle: "Flippe doesn't handle payments. Money, trades, or freebies. All settled directly between you and the other person, your way.",
    icon: "hand-coin-outline",
    accent: "#D97706",
    accentBg: "#FEF3C7",
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
  mode = "sheet",
}: {
  slide: Slide;
  entering: boolean;
  direction: "forward" | "back";
  mode?: 'full' | 'sheet';
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
        { transform: [{ translateX }], opacity, backgroundColor: mode === "sheet" ? theme.colors.surface : "transparent" },
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
  const { visible, open, close, persistOnClose, mode, openId } = useStartupBannersStore();
  const { theme } = useAppTheme();

  const prevOpenIdRef = useRef(openId);

  // Modal entrance animation
  const sheetY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const fullOpacity = useRef(new Animated.Value(0)).current;

  const slides = tab === "seller" ? SELLER_SLIDES : BUYER_SLIDES;
  const slide = slides[index];

  // ── Auth-based auto-open ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (visible) return;
      if (status !== "unauthenticated") return;
      try {
        const v = await SecureStore.getItemAsync(STORAGE_KEY);
        if (mounted && v !== "1") open({ persistOnClose: true, mode: "sheet" });
      } catch {
        if (mounted) open({ persistOnClose: true, mode: "sheet" });
      }
    })();
    return () => { mounted = false; };
  }, [status, visible, open]);

  useEffect(() => {
    if(openId !== prevOpenIdRef.current) {
      prevOpenIdRef.current = openId;
      setTab("seller");
      setIndex(0);
      setDirection("forward");
      setRenderKey((k) => k + 1);
    }
  }, [openId]);

  // ── Sync store → local visibility + animation ──
useEffect(() => {
  if (visible) {
    sheetY.stopAnimation();
    backdropOpacity.stopAnimation();
    fullOpacity.stopAnimation();

    if (mode === "sheet") {
      sheetY.setValue(height);
      backdropOpacity.setValue(0);
      setVisibleLocal(true);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 28,
            stiffness: 280,
            mass: 0.9,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      fullOpacity.setValue(0);
      setVisibleLocal(true);
      requestAnimationFrame(() => {
        Animated.timing(fullOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  } else {
    sheetY.stopAnimation();
    backdropOpacity.stopAnimation();
    fullOpacity.stopAnimation();

    if (mode === "sheet") {
      Animated.parallel([
        Animated.timing(sheetY, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!useStartupBannersStore.getState().visible) {
          setVisibleLocal(false);
        }
      });
    } else {
      Animated.timing(fullOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        if (!useStartupBannersStore.getState().visible) {
          setVisibleLocal(false);
        }
      });
    }
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

  if (mode === "full") {
    return (
      <Modal animationType="none" visible={visibleLocal} transparent={true} statusBarTranslucent hardwareAccelerated>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fullOpacity }]}>
          <View style={[fullStyles.container, { backgroundColor: theme.colors.background }]}>
            <View style={fullStyles.header}>
              <View style={{ width: 40 }} />
              <Text style={[fullStyles.headerTitle, { color: theme.colors.textPrimary }]}>Welcome to Flippe</Text>
              <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <View style={fullStyles.content}>
              <View style={[fullStyles.tabRow, { backgroundColor: theme.colors.surfaceMuted }]}>
                <TabPill label="For Sellers" active={tab === 'seller'} accent={SELLER_SLIDES[0].accent} onPress={() => switchTab('seller')} />
                <TabPill label="For Buyers" active={tab === 'buyer'} accent={BUYER_SLIDES[0].accent} onPress={() => switchTab('buyer')} />
              </View>

              <View style={fullStyles.slideWrap}>
                <SlideCard key={`${tab}-${index}-${renderKey}`} slide={slide} entering direction={direction} mode="full" />
              </View>

              <View style={fullStyles.dotsWrap}>
                <Dots total={slides.length} active={index} accent={accent} />
              </View>
            </View>

            <View style={fullStyles.footer}>
              <View style={fullStyles.controls}>
                <Pressable 
                  onPress={onBack} disabled={index === 0} 
                  style={({ pressed }) => [fullStyles.backBtn, { opacity: index === 0 ? 0 : pressed ? 0.6 : 1, backgroundColor: theme.colors.surfaceMuted }]}
                  accessibilityLabel="Back"
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textSecondary} />
                </Pressable>
                <Pressable 
                  onPress={onNext} 
                  style={({ pressed }) => [fullStyles.nextBtn, { backgroundColor: accent, opacity: pressed ? 0.88 : 1 }]}
                  accessibilityLabel={isLast ? "Get started" : "Next"}
                >
                  {isLast ? (
                    <Text style={[fullStyles.nextLabel, { color: theme.colors.onPrimary }]}>Get started</Text>
                  ) : (
                    <>
                      <Text style={[fullStyles.nextLabel, { color: theme.colors.onPrimary }]}>Next</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color={theme.colors.onPrimary} style={{ marginLeft: 6 }} />
                    </>
                  )}
                </Pressable>
              </View>

              <View style={fullStyles.safeBottom} />
            </View>
          </View>
        </Animated.View>
      </Modal>
    );
  }

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

const fullStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 48 : 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 100,
    padding: 4,
    marginBottom: 40,
  },
  slideWrap: {
    width: SLIDE_WIDTH,
    minHeight: 220,
    alignItems: "center",
    overflow: "hidden",
  },
  dotsWrap: {
    marginTop: 28,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: "center",
    width: "100%",
  },
  controls: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  skip: {
    paddingVertical: 8,  
  },
  skipLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  safeBottom: {
    height: Platform.OS === "ios" ? 24 : 16,
  },
});

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