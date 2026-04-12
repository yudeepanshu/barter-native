import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useTopToastStore } from "@/lib/ui/topToastStore";

const ENTER_DURATION_MS = 210;
const EXIT_DURATION_MS = 170;

function getToastColors(themeMode: "light" | "dark", variant: "info" | "success" | "warning") {
  if (variant === "success") {
    return themeMode === "dark"
      ? { background: "#123326", border: "#1f7a50", title: "#dcfce7", message: "#bbf7d0", icon: "#4ade80" }
      : { background: "#ecfdf3", border: "#86efac", title: "#14532d", message: "#166534", icon: "#16a34a" };
  }

  if (variant === "warning") {
    return themeMode === "dark"
      ? { background: "#3a2a0d", border: "#855d11", title: "#fde68a", message: "#fcd34d", icon: "#f59e0b" }
      : { background: "#fff7ed", border: "#fcd34d", title: "#92400e", message: "#b45309", icon: "#d97706" };
  }

  return themeMode === "dark"
    ? { background: "#12253b", border: "#1d4f8c", title: "#dbeafe", message: "#bfdbfe", icon: "#60a5fa" }
    : { background: "#eff6ff", border: "#93c5fd", title: "#1e3a8a", message: "#1d4ed8", icon: "#2563eb" };
}

export function TopToastHost() {
  const insets = useSafeAreaInsets();
  const { resolvedMode } = useAppTheme();
  const queue = useTopToastStore((state) => state.queue);
  const shiftToast = useTopToastStore((state) => state.shiftToast);

  const activeToast = queue[0] ?? null;
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeToast) {
      return;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: EXIT_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        shiftToast();
      });
    }, activeToast.durationMs);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [activeToast?.id, activeToast?.durationMs, opacity, shiftToast, translateY]);

  if (!activeToast) {
    return null;
  }

  const palette = getToastColors(resolvedMode, activeToast.variant);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View
        style={[
          styles.container,
          {
            marginTop: insets.top + 8,
            opacity,
            transform: [{ translateY }],
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
        ]}
      >
        <Pressable
          onPress={shiftToast}
          android_ripple={{ color: "rgba(148, 163, 184, 0.18)" }}
          style={styles.toastPressable}
        >
          <View style={styles.iconWrap}>
            <Feather name="bell" size={16} color={palette.icon} />
          </View>
          <View style={styles.contentWrap}>
            <Text style={[styles.title, { color: palette.title }]} numberOfLines={2}>
              {activeToast.title}
            </Text>
            {activeToast.message ? (
              <Text style={[styles.message, { color: palette.message }]} numberOfLines={2}>
                {activeToast.message}
              </Text>
            ) : null}
          </View>
          <Feather name="x" size={15} color={palette.message} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: "box-none",
  },
  container: {
    marginHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  toastPressable: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  contentWrap: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
  },
  message: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
});
