import type { AuthUser } from "@barter/types";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SessionCardProps {
  user: AuthUser;
  onSignOut: () => void;
  signingOut?: boolean;
  onAvatarPress?: () => void;
  onEditPress?: () => void;
}

export function SessionCard({
  user,
  onSignOut,
  signingOut = false,
  onAvatarPress,
  onEditPress,
}: SessionCardProps) {
  const { theme } = useAppTheme();
  const initials = user.userName.slice(0, 2).toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [user.profilePicture]);

  useEffect(() => {
    if (!imageFailed) {
      return;
    }

    // Retry after a short delay so avatars recover once bucket policy/network is fixed
    // without requiring app restart or re-upload.
    const timer = setTimeout(() => setImageFailed(false), 1500);
    return () => clearTimeout(timer);
  }, [imageFailed]);

  return (
    <View
      style={[
        styles.card,
        theme.shadow.card,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.roundness,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.avatarRow}>
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress}>
          {user.profilePicture && !imageFailed ? (
            <Image
              source={{ uri: user.profilePicture }}
              style={[styles.avatarImage, { borderColor: theme.colors.border }]}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}> 
              <Text style={[styles.avatarText, { color: theme.colors.onPrimary }]}>{initials}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{user.userName}</Text>
            {onEditPress ? (
              <Pressable
                style={[styles.editIconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                onPress={onEditPress}
                hitSlop={8}
              >
                <Text style={[styles.editIconText, { color: theme.colors.textPrimary }]}>✎</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.subtext, { color: theme.colors.textMuted }]}>Member</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <View style={styles.rows}>
        <Row label="Email" value={user.email ?? "—"} />
        <Row label="Phone" value={user.mobileNumber ?? "—"} />
      </View>

      <Button label="Sign out" variant="ghost" onPress={onSignOut} loading={signingOut} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.colors.textSecondary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
  },
  avatarText: { fontSize: 20, fontWeight: "800" },
  nameBlock: { flex: 1, gap: 2 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { fontSize: 18, fontWeight: "800" },
  editIconButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editIconText: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtext: { fontSize: 13 },
  divider: { height: 1 },
  rows: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { width: 56, fontSize: 13, fontWeight: "700" },
  rowValue: { flex: 1, fontSize: 14, fontWeight: "500" },
});
