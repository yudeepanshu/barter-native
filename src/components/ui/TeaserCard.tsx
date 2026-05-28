import { Pressable, View, Text, StyleSheet, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface TeaserCardProps {
  icon?: IconName;
  imageUri?: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  badge?: string;
  rightSlot?: React.ReactNode;
  isAd?: boolean;
}

export function TeaserCard({
  icon,
  imageUri,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  badge,
  rightSlot,
  isAd,
}: TeaserCardProps) {
  const { theme } = useAppTheme();

  const cardStyle = [
    styles.card,
    {
      borderColor: theme.colors.border,
      borderRadius: theme.roundness,
      backgroundColor: theme.colors.surface,
    },
  ];

  const content = (
    <>
      {badge ? (
        <Text style={[styles.badge, { color: theme.colors.textMuted }]}>
          {badge}
        </Text>
      ) : null}

      <View style={styles.row}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.surfaceMuted ?? "#EEF2FF" },
          ]}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.adImage}
              resizeMode="contain"
            />
          ) : icon ? (
            <MaterialCommunityIcons
              name={icon}
              size={22}
              color={theme.colors.primary}
            />
          ) : null}
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>

        {rightSlot ?? null}
      </View>
    </>
  );

  // NativeAdView handles touches for ads — Pressable would swallow them
  if (isAd) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        ...cardStyle,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  adImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  textGroup: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
});