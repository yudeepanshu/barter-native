import { useEffect, useRef, type ReactNode } from "react";
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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

interface IconConfig {
  library: "feather";
  name: FeatherIconName;
  size?: number;
}

interface MaterialIconConfig {
  library: "material";
  name: MaterialIconName;
  size?: number;
}

interface ContentConfig {
  icon: IconConfig | MaterialIconConfig;
  headline: string;
  body: ReactNode;
  tip?: string;
  accentColor: string;
  accentBg: string;
  accentColorDark: string;
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
            icon: { library: "feather", name: "refresh-cw" },
            headline: "Trade complete!",
            body: (
              <>
                Your listing <Text style={styles.bodyBold}>{productTitle}</Text> has been exchanged. Make sure you've handed it over and received the agreed item in return.
              </>
            ),
            tip: "Head to My Listings to review or relist any products.",
            accentColor: "#7c3aed",
            accentColorDark: "#a78bfa",
            accentBg: "#ede9fe",
            accentBgDark: "#1e1b4b",
          }
        : {
            icon: { library: "feather", name: "refresh-cw" },
            headline: "Trade complete!",
            body: (
              <>
                You've successfully traded for <Text style={styles.bodyBold}>{productTitle}</Text>. Confirm you have the item in hand before leaving.
              </>
            ),
            tip: "Check My Listings to see your updated collection.",
            accentColor: "#7c3aed",
            accentColorDark: "#a78bfa",
            accentBg: "#ede9fe",
            accentBgDark: "#1e1b4b",
          };

    case "MONEY":
      return isSeller
        ? {
            icon: { library: "material", name: "payments", size: 30 },
            headline: "Collect your payment!",
            body: (
              <>
                The exchange for <Text style={styles.bodyBold}>{productTitle}</Text> is confirmed. Make sure you've received the agreed payment from the buyer before handing over the item.
              </>
            ),
            tip: "Don't release the item until the payment is in your hands.",
            accentColor: "#15803d",
            accentColorDark: "#4ade80",
            accentBg: "#dcfce7",
            accentBgDark: "#052e16",
          }
        : {
            icon: { library: "material", name: "payments", size: 30 },
            headline: "Send your payment!",
            body: (
              <>
                The exchange for <Text style={styles.bodyBold}>{productTitle}</Text> is confirmed. Pay the seller the agreed amount now and collect your item.
              </>
            ),
            tip: "Only pay through a method you both agreed on. Stay safe.",
            accentColor: "#15803d",
            accentColorDark: "#4ade80",
            accentBg: "#dcfce7",
            accentBgDark: "#052e16",
          };

    case "MIXED":
      return isSeller
        ? {
            icon: { library: "material", name: "handshake", size: 30 },
            headline: "Exchange complete!",
            body: (
              <>
                The mixed trade for <Text style={styles.bodyBold}>{productTitle}</Text> is finalised. Verify you've received both the product(s) and the agreed cash before wrapping up.
              </>
            ),
            // tip: "Head to My Listings to check your active items.",
            accentColor: "#0369a1",
            accentColorDark: "#38bdf8",
            accentBg: "#e0f2fe",
            accentBgDark: "#0c3553",
          }
        : {
            icon: { library: "material", name: "handshake", size: 30 },
            headline: "Exchange complete!",
            body: (
              <>
                Your mixed offer for <Text style={styles.bodyBold}>{productTitle}</Text> was accepted and finalised. Make sure the seller has everything you agreed to exchange.
              </>
            ),
            accentColor: "#0369a1",
            accentColorDark: "#38bdf8",
            accentBg: "#e0f2fe",
            accentBgDark: "#0c3553",
          };

    case "NONE":
    default:
      return isSeller
        ? {
            icon: { library: "feather", name: "gift" },
            headline: "Thank you for giving!",
            body: (
              <>
                You've gifted <Text style={styles.bodyBold}>{productTitle}</Text> to someone who needed it. Generosity like yours makes this community great.
              </>
            ),
            tip: "Your contribution has been recorded. Why not list something else?",
            accentColor: "#b45309",
            accentColorDark: "#fbbf24",
            accentBg: "#fef3c7",
            accentBgDark: "#451a03",
          }
        : {
            icon: { library: "feather", name: "gift" },
            headline: "You got it for free!",
            body: (
              <>
                <Text style={styles.bodyBold}>{productTitle}</Text> is now yours — given freely by a generous community member. Use it well and pay it forward someday!
              </>
            ),
            accentColor: "#b45309",
            accentColorDark: "#fbbf24",
            accentBg: "#fef3c7",
            accentBgDark: "#451a03",
          };
  }
}

// ─── Icon bubble ──────────────────────────────────────────────────────────────

function IconBubble({
  icon,
  accentBg,
  accentText,
  scaleAnim,
}: {
  icon: ContentConfig["icon"];
  accentBg: string;
  accentText: string;
  scaleAnim: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.iconBubble,
        { backgroundColor: accentBg, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {icon.library === "feather" ? (
        <Feather
          name={(icon as IconConfig).name}
          size={icon.size ?? 28}
          color={accentText}
        />
      ) : (
        <MaterialIcons
          name={(icon as MaterialIconConfig).name}
          size={icon.size ?? 30}
          color={accentText}
        />
      )}
    </Animated.View>
  );
}

// ─── Animated particle ────────────────────────────────────────────────────────

function ParticleDot({
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

const PARTICLE_COLORS = ["#f97316", "#8b5cf6", "#0ea5e9", "#22c55e", "#ec4899", "#eab308"];

function ParticleBurst() {
  const dots = Array.from({ length: 18 }, (_, i) => ({
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    delay: Math.random() * 400,
    startX: (Math.random() - 0.5) * 200,
    size: 6 + Math.random() * 6,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((dot, i) => (
        <ParticleDot key={i} {...dot} />
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

  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scaleAnim.setValue(0.82);
    iconScale.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(iconScale, {
          toValue: 1,
          damping: 10,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [visible]);

  const content = getContent(offerType, isSeller, productTitle);
  const isDark = theme.mode === "dark";

  const accentBg = isDark ? content.accentBgDark : content.accentBg;
  const accentText = isDark ? content.accentColorDark : content.accentColor;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        android_ripple={null}
        accessible={false}
      >
        <Pressable android_ripple={null} onPress={() => {}} style={{ width: "95%", maxWidth: 400 }}>
          <Animated.View
            accessible
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Particles */}
            <ParticleBurst />

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
              {/* Icon bubble */}
              <IconBubble
                icon={content.icon}
                accentBg={accentBg}
                accentText={accentText}
                scaleAnim={iconScale}
              />

              {/* Congratulations badge */}
              <View style={[styles.congrats, { backgroundColor: accentBg }]}>
                <Feather name="award" size={12} color={isDark ? "#ffffff" : accentText} />
                <Text style={[styles.congratsText, { color: isDark ? "#ffffff" : accentText }]}>
                  Congratulations!
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
                      backgroundColor: accentBg,
                      borderColor: isDark ? content.accentColor + "40" : content.accentColor + "30",
                    },
                  ]}
                >
                  <Feather
                    name="info"
                    size={14}
                    color={accentText}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={[styles.tipText, { color: isDark ? "#e2e8f0" : theme.colors.textPrimary }]}>
                    {content.tip}
                  </Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actions}>
                {(offerType === "PRODUCT" || offerType === "MIXED" || (offerType === "NONE" && isSeller)) ? (
                  <Pressable
                    style={styles.textLink}
                    onPress={() => {
                      onClose();
                      router.push("/(app)/(tabs)/my-listings" as any);
                    }}
                    hitSlop={8}
                  >
                    <Text style={[styles.textLinkLabel, { color: isDark ? "#e2e8f0" : accentText }]}>
                      View My Listings
                    </Text>
                    <Feather name="arrow-right" size={14} color={isDark ? "#e2e8f0" : accentText} />
                  </Pressable>
                ) : null}

                {/* Primary close */}
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: accentText }]}
                  onPress={() => {
                    onClose();
                    router.push("/(app)/(tabs)/home" as any);
                  }}
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
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  congrats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
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
  bodyBold: {
    fontWeight: "700",
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
  textLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  textLinkLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});