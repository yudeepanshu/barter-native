import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/hooks/useAppTheme";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExchangeOfferType = "PRODUCT" | "MONEY" | "MIXED" | "NONE";

interface ExchangeSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  /** The offer type that was finalised */
  offerType: ExchangeOfferType;
  /** true = current user is the seller, false = buyer */
  isSeller: boolean;
  /** Title of the listing that was exchanged */
  productTitle?: string;
}

// ─── Content helpers ──────────────────────────────────────────────────────────

interface ContentConfig {
  emoji: string;
  headline: string;
  body: string;
  tip?: string;
  accentColor: string;
  accentBg: string;
  accentBgDark: string;
}

function getContent(
  offerType: ExchangeOfferType,
  isSeller: boolean,
  productTitle: string,
): ContentConfig {
  switch (offerType) {
    case "PRODUCT":
      return isSeller
        ? {
            emoji: "🔄",
            headline: "Trade complete!",
            body: `Your listing "${productTitle}" has been exchanged. Make sure you've handed it over and received the agreed item in return.`,
            tip: "Head to My Listings to review or relist any products.",
            accentColor: "#0369a1",
            accentBg: "#e0f2fe",
            accentBgDark: "#0c4a6e",
          }
        : {
            emoji: "🔄",
            headline: "Trade complete!",
            body: `You've successfully traded for "${productTitle}". Confirm you have the item in hand before leaving.`,
            tip: "Check My Listings to see your updated collection.",
            accentColor: "#0369a1",
            accentBg: "#e0f2fe",
            accentBgDark: "#0c4a6e",
          };

    case "MONEY":
      return isSeller
        ? {
            emoji: "💸",
            headline: "Collect your payment!",
            body: `The exchange for "${productTitle}" is confirmed. Make sure you've received the agreed payment from the buyer before handing over the item.`,
            tip: "Don't release the item until the payment is in your hands.",
            accentColor: "#15803d",
            accentBg: "#dcfce7",
            accentBgDark: "#14532d",
          }
        : {
            emoji: "💸",
            headline: "Send your payment!",
            body: `The exchange for "${productTitle}" is confirmed. Pay the seller the agreed amount now and collect your item.`,
            tip: "Only pay through a method you both agreed on. Stay safe.",
            accentColor: "#15803d",
            accentBg: "#dcfce7",
            accentBgDark: "#14532d",
          };

    case "MIXED":
      return isSeller
        ? {
            emoji: "🤝",
            headline: "Exchange complete!",
            body: `The mixed trade for "${productTitle}" is finalised. Verify you've received both the product(s) and the agreed cash before wrapping up.`,
            tip: "Head to My Listings to check your active items.",
            accentColor: "#7c3aed",
            accentBg: "#ede9fe",
            accentBgDark: "#3b0764",
          }
        : {
            emoji: "🤝",
            headline: "Exchange complete!",
            body: `Your mixed offer for "${productTitle}" was accepted and finalised. Make sure the seller has everything you agreed to exchange.`,
            accentColor: "#7c3aed",
            accentBg: "#ede9fe",
            accentBgDark: "#3b0764",
          };

    case "NONE":
    default:
      return isSeller
        ? {
            emoji: "🎁",
            headline: "Thank you for giving!",
            body: `You've gifted "${productTitle}" to someone who needed it. Generosity like yours makes this community great.`,
            tip: "Your contribution has been recorded. Why not list something else?",
            accentColor: "#b45309",
            accentBg: "#fef3c7",
            accentBgDark: "#78350f",
          }
        : {
            emoji: "🎁",
            headline: "You got it for free!",
            body: `"${productTitle}" is now yours — given freely by a generous community member. Use it well and pay it forward someday!`,
            accentColor: "#b45309",
            accentBg: "#fef3c7",
            accentBgDark: "#78350f",
          };
  }
}

// ─── Animated confetti dot ────────────────────────────────────────────────────

function ConfettiDot({
  color,
  delay,
  startX,
  size,
}: {
  color: string;
  delay: number;
  startX: number;
  size: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -120,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate: spin }],
      }}
    />
  );
}

const CONFETTI_COLORS = ["#f97316", "#8b5cf6", "#0ea5e9", "#22c55e", "#ec4899", "#eab308"];

function ConfettiBurst() {
  const dots = Array.from({ length: 18 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 400,
    startX: (Math.random() - 0.5) * 200,
    size: 6 + Math.random() * 6,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((dot, i) => (
        <ConfettiDot key={i} {...dot} />
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExchangeSuccessModal({
  visible,
  onClose,
  offerType,
  isSeller,
  productTitle = "this item",
}: ExchangeSuccessModalProps) {
  const { theme } = useAppTheme();
  const router = useRouter();

  const sheetRef = useRef<View>(null);

  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scaleAnim.setValue(0.82);
    opacityAnim.setValue(0);
    emojiScale.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(emojiScale, {
          toValue: 1,
          damping: 10,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setTimeout(() => {
        sheetRef.current?.focus();
    }, 50);

  }, [visible]);

  const content = getContent(offerType, isSeller, productTitle);
  const isDark = theme.mode === "dark";

  const accentBg = isDark ? content.accentBgDark : content.accentBg;
  const accentText = content.accentColor;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessible={false}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            ref={sheetRef}
            focusable
            accessible
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            {/* Confetti */}
            <ConfettiBurst />

            {/* Close button */}
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: theme.colors.border }]}
              hitSlop={8}
            >
              <Feather name="x" size={16} color={theme.colors.textSecondary} />
            </Pressable>

            <ScrollView
              contentContainerStyle={styles.inner}
              showsVerticalScrollIndicator={false}
            >
              {/* Emoji bubble */}
              <Animated.View
                style={[
                  styles.emojiBubble,
                  { backgroundColor: accentBg, transform: [{ scale: emojiScale }] },
                ]}
              >
                <Text style={styles.emojiText}>{content.emoji}</Text>
              </Animated.View>

              {/* Congratulations badge */}
              <View style={[styles.congrats, { backgroundColor: accentBg }]}>
                <Text style={[styles.congratsText, { color: accentText }]}>
                  🎉 Congratulations!
                </Text>
              </View>

              {/* Headline */}
              <Text style={[styles.headline, { color: theme.colors.textPrimary }]}>
                {content.headline}
              </Text>

              {/* Body */}
              <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                {content.body}
              </Text>

              {/* Tip box */}
              {content.tip ? (
                <View
                  style={[
                    styles.tipBox,
                    {
                      backgroundColor: isDark
                        ? theme.colors.surfaceMuted
                        : theme.colors.surfaceMuted,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="info"
                    size={14}
                    color={theme.colors.textMuted}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={[styles.tipText, { color: theme.colors.textMuted }]}>
                    {content.tip}
                  </Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actions}>
                {/* My Listings shortcut — relevant for trades/free */}
                {(offerType === "PRODUCT" || offerType === "MIXED" || (offerType === "NONE" && isSeller)) ? (
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                    ]}
                    onPress={() => {
                      onClose();
                      router.push("/(app)/(tabs)/my-listings" as any);
                    }}
                  >
                    <Feather name="list" size={15} color={theme.colors.textSecondary} />
                    <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>
                      View My Listings
                    </Text>
                  </Pressable>
                ) : null}

                {/* Primary close */}
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: accentText }]}
                  onPress={onClose}
                >
                  <Feather name="check" size={15} color="#ffffff" />
                  <Text style={styles.primaryBtnText}>Done</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: "center",
    gap: 14,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emojiText: {
    fontSize: 36,
  },
  congrats: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  congratsText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 28,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  tipBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "flex-start",
    alignSelf: "stretch",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});