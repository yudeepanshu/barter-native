import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: string;
  text?: string;
}

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "PENDING": return { bg: "#fef3c7", text: "#b45309" };
    case "NEGOTIATING": return { bg: "#dbeafe", text: "#1d4ed8" };
    case "ACCEPTED": return { bg: "#dcfce7", text: "#15803d" };
    case "REJECTED": return { bg: "#fee2e2", text: "#b91c1c" };
    case "CANCELLED": return { bg: "#f1f5f9", text: "#111827" };
    case "COMPLETED": return { bg: "#ccfbf1", text: "#0f766e" };
    default: return { bg: "#e2e8f0", text: "#334155" };
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
const { theme } = useAppTheme();
  const style = getStatusBadgeStyle(status);
  return (
    <View style={styles.container}>
        <Text style={[styles.sideText, { color: theme.colors.textMuted }]}>{text}</Text>
        <View style={[styles.badge, { backgroundColor: style.bg, borderWidth: status === "CANCELLED" ? 1 : 0, borderColor: status === "CANCELLED" ? "#111827" : "transparent" }]}>
        <Text style={[styles.badgeText, { color: style.text }]}>{status}</Text>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sideText: {
        fontSize: 15,
        fontWeight: "500",
    },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});