import { Pressable, View, Text, StyleSheet, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { NativeAsset, NativeAssetType } from "react-native-google-mobile-ads";

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

  // ── Icon / image slot ──
  // For ads: NativeAsset must have the Image as a direct child — no wrapping View
  const iconSlot = isAd && imageUri ? (
    <NativeAsset assetType={NativeAssetType.ICON}>
      <Image
        source={{ uri: imageUri }}
        style={styles.adImage}
        resizeMode="contain"
      />
    </NativeAsset>
  ) : (
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
  );

  const content = (
    <>
      {badge ? (
        <Text style={[styles.badge, { color: theme.colors.textMuted }]}>
          {badge}
        </Text>
      ) : null}

      <View style={styles.row}>
        {iconSlot}

        <View style={styles.textGroup}>
          {isAd ? (
            // NativeAsset direct child — no wrapping View
            <>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                  {title}
                </Text>
              </NativeAsset>
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text
                  style={[styles.subtitle, { color: theme.colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              </NativeAsset>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                {title}
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.colors.textSecondary }]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            </>
          )}
        </View>

        {rightSlot ?? null}
      </View>
    </>
  );

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