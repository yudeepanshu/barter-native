import { StyleSheet, Text, View } from "react-native";

export function ProductExchangeBadge({
  position = "left",
}: {
  position?: "left" | "right";
}) {
  return (
    <View style={[styles.badgeWrap, position === "left" ? styles.badgeLeft : styles.badgeRight]}>
      <Text style={styles.badgeText} numberOfLines={1}>Previously traded</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    position: "absolute",
    top: 8,
    borderWidth: 0,
    borderLeftWidth: 3,
    borderLeftColor: "#60a5fa",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: "80%",
  },
  badgeRight: {
    right: 8,
  },
  badgeLeft: {
    left: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});