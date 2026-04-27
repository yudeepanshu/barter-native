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

export interface ErrorViewAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "success";
  style?: StyleProp<ViewStyle>;
}

interface ErrorViewProps {
  title: string;
  message: string;
  illustration?: ReactNode;
  buttons?: ErrorViewAction[];
  style?: StyleProp<ViewStyle>;
}

export function ErrorView({
  title,
  message,
  illustration,
  buttons,
  style,
}: ErrorViewProps) {
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
      <Feather name="alert-triangle" size={36} color={theme.colors.danger} />
    </View>
  );

  const isSingleButton = buttons?.length === 1;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.card,
          {
            maxWidth: maxContentWidth,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.illustrationWrap}>
          {illustration ?? fallbackIllustration}
        </View>

        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>

        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          {message}
        </Text>

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
    minHeight: 300,
  },
  card: {
    width: "100%",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
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
    fontSize: 20,
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
    marginTop: 12,
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