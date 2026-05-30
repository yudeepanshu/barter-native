import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppDialog } from "@/providers/AppDialogProvider";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SupportOption } from "@barter/types";

type IconConfig = {
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
};

const ICON_BY_ID: Record<string, IconConfig> = {
  email: { name: "email-outline", color: "#4A90E2" },
  reddit: { name: "reddit", color: "#FF4500" },
};

const ICON_FALLBACK_BY_TYPE: Record<SupportOption["type"], IconConfig> = {
  external: { name: "open-in-new", color: "#6B7280" },
  mailto: { name: "email-outline", color: "#4A90E2" },
  inapp: { name: "message-text-outline", color: "#6B7280" },
  phone: { name: "phone-outline", color: "#6B7280" },
  form: { name: "file-document-outline", color: "#6B7280" },
};

function getIconConfig(option: SupportOption): IconConfig {
  return ICON_BY_ID[option.id] ?? ICON_FALLBACK_BY_TYPE[option.type];
}

function normalizeSupportUrl(option: SupportOption): string | null {
  if (!option.url) return null;

  switch (option.type) {
    case "mailto":
      return option.url.startsWith("mailto:") ? option.url : `mailto:${option.url}`;
    case "phone":
      return option.url.startsWith("tel:") ? option.url : `tel:${option.url}`;
    default:
      return option.url;
  }
}

export function SupportOptionsDialogContent({ options }: { options: SupportOption[] }) {
  const { theme } = useAppTheme();
  const dialog = useAppDialog();

  const handleOptionPress = async (option: SupportOption) => {
    const url = normalizeSupportUrl(option);
    if (!url) {
      await dialog.alert("Support unavailable", "This support option is not available right now.");
      return;
    }

    try {
      const isWebUrl = url.startsWith("http://") || url.startsWith("https://");

      if (!isWebUrl) {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) throw new Error("Unable to open URL");
      }

      await Linking.openURL(url);
    } catch {
      await dialog.alert("Unable to open", "Please try again later.");
    }
  };

  return (
    <View style={[styles.root, { borderColor: theme.colors.border }]}>
      {options.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrapper, { backgroundColor: theme.colors.surfaceMuted }]}>
            <MaterialCommunityIcons
              name="help-circle-outline"
              size={48}
              color={theme.colors.textMuted}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            No support options available
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Support options are not available right now. Please try again later.
          </Text>
        </View>
      ) : (
        options.map((option) => {
          const { name: iconName, color: iconColor } = getIconConfig(option);
          const disabled = !option.url;
          return (
            <Pressable
              key={option.id}
              onPress={() => void handleOptionPress(option)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  opacity: disabled ? 0.6 : pressed ? 0.86 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons name={iconName} size={40} color={iconColor} />
              <View style={styles.textGroup}>
                <Text style={[styles.optionName, { color: theme.colors.textPrimary }]}>
                  {option.name}
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
    marginTop: 12,
  },
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  textGroup: {
    flex: 1,
    gap: 4,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "700",
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});