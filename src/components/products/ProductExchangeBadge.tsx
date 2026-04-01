import { StyleSheet, Text, View } from "react-native";

export function ProductExchangeBadge() {
  return (
    <View style={styles.badgeWrap}>
      <Text style={styles.badgeText} numberOfLines={1}>Previously exchanged</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    borderWidth: 1,
    borderColor: "#fdba74",
    backgroundColor: "rgba(255, 237, 213, 0.96)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "80%",
  },
  badgeText: {
    color: "#9a3412",
    fontSize: 11,
    fontWeight: "700",
  },
});
