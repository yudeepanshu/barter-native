import type { AuthUser } from "@barter/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { AppImage } from "@/components/ui/AppImage";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Feather } from "@expo/vector-icons";
import { Button } from "../ui/Button";

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
  const isSigningOut = signingOut;
  const initials = user.userName.slice(0, 2).toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);
  const activeSinceLabel =formatActiveSince(user.createdAt);

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
            <AppImage
              uri={user.profilePicture}
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
            <Text
              style={[styles.name, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {user.userName}
            </Text>
            {onEditPress ? (
              <Pressable
                style={[styles.editIconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                onPress={onEditPress}
                hitSlop={8}
              >
                <Text style={[styles.editIconText, { color: theme.colors.textPrimary }]}>
                  <Feather name="edit-2" size={16} />
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.subtext, { color: theme.colors.textMuted }]}>{activeSinceLabel}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <View style={styles.rows}>
        <Row label="Email" value={user.email ?? "—"} />
        <Row label="Phone" value={user.mobileNumber ?? "—"} />
      </View>

      <Button
        label="Sign out"
        onPress={()=> {
          if (!isSigningOut) {
            onSignOut();
          }
        }}
        variant="ghost"
        disabled={isSigningOut}
        loading={isSigningOut}
      />
    </View>
  );
}

function formatActiveSince(createdAt?: string) {
  const prefix = "Active since: ";
  if (!createdAt) {
    return `${prefix}Today`;
  }

  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return `${prefix}Today`;
  }

  const elapsedMs = Date.now() - createdTime;
  if (elapsedMs <= 0) {
    return `${prefix}Today`;
  }

  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  if (days < 1) {
    return `${prefix}Today`;
  }
  if (days < 30) {
    return `${prefix}${days} day${days === 1 ? "" : "s"}`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${prefix}${months} month${months === 1 ? "" : "s"}`;
  }

  const years = Math.floor(days / 365);
  return `${prefix}${years} year${years === 1 ? "" : "s"}`;
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
  name: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: "800" },
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
  signOutButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  signOutLabel: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
});
