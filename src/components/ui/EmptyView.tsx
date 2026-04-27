import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Button } from "@/components/ui/Button";
import { Feather } from "@expo/vector-icons";

export interface EmptyViewAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "success";
  style?: StyleProp<ViewStyle>;
}

interface EmptyViewProps {
  title: string;
  message?: string;
  /** Optional illustration rendered above the title. Pass any ReactNode (Image, SVG, icon, etc.). */
  illustration?: ReactNode;
  /** Buttons rendered below the message. Rendered in the order provided. */
  buttons?: EmptyViewAction[];
  style?: StyleProp<ViewStyle>;
}

export function EmptyView({
  title,
  message,
  illustration,
  buttons,
  style,
}: EmptyViewProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const maxContentWidth = Math.min(width - 48, 400);

  const fallbackIllustration = (
    <View
      style={[
        styles.defaultIconContainer,
        { backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      <Feather name="inbox" size={36} color={theme.colors.textMuted} />
    </View>
  );

  const isSingleButton = buttons?.length === 1;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.content, { maxWidth: maxContentWidth }]}>
        <View style={styles.illustrationWrap}>
          {illustration ?? fallbackIllustration}
        </View>

        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>

        {message ? (
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>
            {message}
          </Text>
        ) : null}

        {buttons && buttons.length > 0 ? (
          <View style={[styles.actions, isSingleButton && styles.actionsSingle]}>
            {buttons.map((btn, index) => (
              <Button
                key={index}
                label={btn.label}
                onPress={btn.onPress}
                variant={btn.variant ?? "primary"}
                style={[
                  isSingleButton ? styles.buttonSingle : styles.buttonMulti,
                  btn.style,
                ]}
              />
            ))}
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
    padding: 24,
  },
  content: {
    width: "100%",
    alignItems: "center",
    gap: 6,
  },
  illustrationWrap: {
    marginBottom: 8,
    alignItems: "center",
  },
  defaultIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    width: "100%",
    marginTop: 8,
    gap: 10,
  },
  actionsSingle: {
    justifyContent: "center",
  },
  buttonMulti: {
    flex: 1,
  },
  buttonSingle: {
    alignSelf: "center",
    paddingHorizontal: 24,
  },
});