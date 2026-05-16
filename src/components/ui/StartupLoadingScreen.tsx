import React from "react";
import { ActivityIndicator, Easing, Pressable, StyleSheet, Text, View, Animated, Dimensions } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useAppTheme } from "@/hooks/useAppTheme";

interface StartupLoadingScreenProps {
  timedOut: boolean;
  onContinue: () => void;
}

export function StartupLoadingScreen({ timedOut, onContinue }: StartupLoadingScreenProps) {
  const { theme } = useAppTheme();
  const screen = Dimensions.get("window");
  const splashHiddenRef = React.useRef(false);
  // Ball 1 (top left)
  const ball1Size = 240;
  const ball1Color = theme.mode === "dark" ? "rgba(56, 189, 248, 0.12)" : "rgba(14, 165, 233, 0.14)";
  // Ball 2 (bottom right)
  const ball2Size = 260;
  const ball2Color = theme.mode === "dark" ? "rgba(249, 115, 22, 0.1)" : "rgba(249, 115, 22, 0.12)";

  // One linear 0→1 progress value per axis. Interpolated to the real position
  // with a [0, 0.5, 1] keyframe so the ball bounces end-to-end.
  // Using a single long Animated.timing means JS is only touched once per
  // loop restart (≈15 s), not at every mid-bounce turn, so heavy JS load
  // during auth bootstrap cannot freeze the animation.
  const ball1XProg = React.useRef(new Animated.Value(0)).current;
  const ball1YProg = React.useRef(new Animated.Value(0)).current;
  const ball2XProg = React.useRef(new Animated.Value(0)).current;
  const ball2YProg = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const makeAnim = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(val, { toValue: 1, duration, useNativeDriver: true, easing: Easing.linear })
      );

    const anims = [
      makeAnim(ball1XProg, 14200),
      makeAnim(ball1YProg, 11600),
      makeAnim(ball2XProg, 13100),
      makeAnim(ball2YProg, 16400),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [ball1XProg, ball1YProg, ball2XProg, ball2YProg]);

  return (
    <View
      onLayout={() => {
        if (splashHiddenRef.current) {
          return;
        }

        splashHiddenRef.current = true;
        requestAnimationFrame(() => {
          void SplashScreen.hideAsync().catch(() => {
            // Best effort. Ignore if already hidden.
          });
        });
      }}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Animated balls in the background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            styles.ball,
            {
              width: ball1Size,
              height: ball1Size,
              borderRadius: ball1Size / 2,
              backgroundColor: ball1Color,
              transform: [
                { translateX: ball1XProg.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, screen.width - ball1Size, 0] }) },
                { translateY: ball1YProg.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, screen.height - ball1Size, 0] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ball,
            {
              width: ball2Size,
              height: ball2Size,
              borderRadius: ball2Size / 2,
              backgroundColor: ball2Color,
              transform: [
                { translateX: ball2XProg.interpolate({ inputRange: [0, 0.5, 1], outputRange: [screen.width - ball2Size, 0, screen.width - ball2Size] }) },
                { translateY: ball2YProg.interpolate({ inputRange: [0, 0.5, 1], outputRange: [screen.height - ball2Size, 0, screen.height - ball2Size] }) },
              ],
            },
          ]}
        />
      </View>

      {/* Card stays above balls */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.roundness,
            shadowColor: theme.shadow.card.shadowColor,
            shadowOpacity: theme.shadow.card.shadowOpacity,
            shadowOffset: theme.shadow.card.shadowOffset,
            shadowRadius: theme.shadow.card.shadowRadius,
            elevation: theme.shadow.card.elevation,
          },
        ]}
      >
        <View style={[styles.logoBadge, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}> 
          <Text style={[styles.logoText, { color: theme.colors.textPrimary }]}>Flippe</Text>
        </View>

        <ActivityIndicator size={28} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Loading your marketplace</Text>
        {/* <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Syncing account and startup data...</Text> */}

        {timedOut ? (
          <View style={styles.timeoutWrap}>
            <Text style={[styles.timeoutText, { color: theme.colors.textSecondary }]}>Startup is taking longer than expected.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={({ pressed }) => [
                styles.continueButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Text style={[styles.continueText, { color: theme.colors.onPrimary }]}>Continue to login</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    alignItems: "center",
  },
  ball: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  logoBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  logoText: {
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    textAlign: "center",
  },
  timeoutWrap: {
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  timeoutText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  continueButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    alignSelf: "stretch",
  },
  continueText: {
    fontSize: 14.5,
    fontWeight: "700",
  },
});