import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRef, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { NotificationSummary } from "@barter/types";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useClearAllNotificationsMutation,
  useClearNotificationMutation,
} from "@/hooks/mutations/useNotificationMutations";
import { useNotificationsQuery } from "@/hooks/queries/useNotificationsQuery";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CustomFlatList } from "../ui/CustomFlatList";

const SWIPE_THRESHOLD = 80;
const ITEM_HEIGHT = 80;

function formatNotificationTime(dateString: string): { time: string; date: string } {
  const date = new Date(dateString);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  return { time, date: dateStr };
}

interface SwipeableNotificationItemProps {
  item: NotificationSummary;
  onOpen: (item: NotificationSummary) => void;
  onDelete: (id: string) => void;
  themeColors: ReturnType<typeof useAppTheme>["theme"]["colors"];
}

function SwipeableNotificationItem({
  item,
  onOpen,
  onDelete,
  themeColors,
}: SwipeableNotificationItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;
  const isDismissing = useRef(false);

  const dismiss = () => {
    if (isDismissing.current) return;
    isDismissing.current = true;

    Animated.sequence([
      Animated.timing(translateX, {
        toValue: -500,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
    ]).start(() => {
      onDelete(item.id);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Claim the responder only for predominantly horizontal moves
          return (
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
            Math.abs(gestureState.dx) > 5
          );
        },
        onPanResponderMove: (_, gestureState) => {
          // Left-only swipe; clamp right at 0
          translateX.setValue(Math.min(0, gestureState.dx));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -SWIPE_THRESHOLD) {
            dismiss();
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          // Reset if scroll steals the responder
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { time, date } = formatNotificationTime(item.createdAt);

  return (
    <Animated.View
      style={{
        maxHeight: heightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, ITEM_HEIGHT * 2],
        }),
        opacity: heightAnim,
        overflow: "hidden",
      }}
    >
      {/* Red background revealed on swipe */}
      <View style={[styles.swipeBackground, { backgroundColor: "#dc2626" }]}>
        <Feather name="trash-2" size={20} color="#fff" />
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          onPress={() => onOpen(item)}
          style={[
            styles.notificationItem,
            {
              borderColor: themeColors.border,
              backgroundColor: item.isRead ? themeColors.surface : themeColors.surfaceMuted,
            },
          ]}
        >
          <Text style={[styles.notificationItemTitle, { color: themeColors.textPrimary }]}>
            {item.title}
          </Text>
          <Text style={[styles.notificationItemBody, { color: themeColors.textSecondary }]}>
            {item.body}
          </Text>
          <View style={styles.notificationItemMetaRow}>
            <Text style={[styles.notificationItemMeta, { color: themeColors.textMuted }]}>
              {time}
            </Text>
            <Text style={[styles.notificationItemMeta, { color: themeColors.textMuted }]}>
              {date}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

interface NotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ visible, onClose }: NotificationsPanelProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  const notificationsQuery = useNotificationsQuery({ limit: 20 });
  const markNotificationReadMutation = useMarkNotificationReadMutation();
  const markAllNotificationsReadMutation = useMarkAllNotificationsReadMutation();
  const clearAllNotificationsMutation = useClearAllNotificationsMutation();
  const clearNotificationMutation = useClearNotificationMutation();

  const notifications =
    notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));

  const onRefreshNotifications = async () => {
    await notificationsQuery.refetch();
  };

  const onOpenNotification = async (item: NotificationSummary) => {
    if (!item.isRead) {
      await markNotificationReadMutation.mutateAsync(item.id);
    }

    onClose();

    const payload = item.data ?? {};
    const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
    const productId = typeof payload.productId === "string" ? payload.productId : null;

    if (requestId) {
      router.push(`/(app)/requests/${requestId}`);
      return;
    }

    if (productId) {
      router.push(`/(app)/products/${productId}`);
    }
  };

  const onDeleteNotification = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    void clearNotificationMutation.mutateAsync(id).catch(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.notificationsBackdrop, { backgroundColor: theme.colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.notificationsPanel,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
          onPress={() => {
            // Keep panel open when tapping inside.
          }}
        >
          <View style={styles.notificationsHeaderRow}>
            <Text style={[styles.notificationsTitle, { color: theme.colors.textPrimary }]}>
              Notifications
            </Text>
            <View style={styles.notificationsActionsRow}>
              <Pressable
                onPress={() => void onRefreshNotifications()}
                disabled={notificationsQuery.isFetching}
                style={styles.notificationsIconAction}
              >
                {notificationsQuery.isFetching ? (
                  <ActivityIndicator size={14} color={theme.colors.textSecondary} />
                ) : (
                  <Feather name="refresh-cw" size={15} color={theme.colors.textSecondary} />
                )}
              </Pressable>

              {visibleNotifications.length > 0 ? (
                <>
                  <Pressable
                    onPress={() => {
                      void clearAllNotificationsMutation.mutateAsync();
                      onClose();
                    }}
                    disabled={clearAllNotificationsMutation.isPending}
                    style={styles.notificationsActionButton}
                  >
                    <Text
                      style={[
                        styles.notificationsActionText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Clear all
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowNotificationsMenu((prev) => !prev)}
                    style={styles.notificationsIconAction}
                  >
                    <Feather
                      name={showNotificationsMenu ? "chevron-up" : "chevron-down"}
                      size={15}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          {showNotificationsMenu ? (
            <View
              style={[
                styles.notificationsMenu,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  void markAllNotificationsReadMutation.mutateAsync();
                  setShowNotificationsMenu(false);
                }}
                disabled={unreadCount === 0 || markAllNotificationsReadMutation.isPending}
                style={styles.notificationsMenuItem}
              >
                {markAllNotificationsReadMutation.isPending ? (
                  <ActivityIndicator size={14} color={theme.colors.textPrimary} />
                ) : (
                  <Feather name="check" size={14} color={theme.colors.textPrimary} />
                )}
                <Text
                  style={[
                    styles.notificationsMenuItemText,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  Mark all read
                </Text>
              </Pressable>
            </View>
          ) : null}

          {notificationsQuery.isFetching && visibleNotifications.length === 0 ? (
            <View style={styles.notificationsLoadingWrap}>
              <ActivityIndicator size={20} color={theme.colors.primary} />
            </View>
          ) : visibleNotifications.length === 0 ? (
            <Text style={[styles.notificationsEmpty, { color: theme.colors.textMuted }]}>
              No updates yet.
            </Text>
          ) : (
            <CustomFlatList
              data={visibleNotifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.notificationsList}
              renderItem={({ item }) => (
                <SwipeableNotificationItem
                  item={item}
                  onOpen={(n) => void onOpenNotification(n)}
                  onDelete={onDeleteNotification}
                  themeColors={theme.colors}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              onEndReachedThreshold={0.3}
              onEndReached={() => {
                if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
                  void notificationsQuery.fetchNextPage();
                }
              }}
              ListFooterComponent={
                notificationsQuery.isFetchingNextPage ? (
                  <View style={styles.notificationsLoadingWrap}>
                    <ActivityIndicator size={16} color={theme.colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notificationsBackdrop: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 96,
    paddingBottom: 24,
  },
  notificationsPanel: {
    borderWidth: 1,
    borderRadius: 14,
    maxHeight: "76%",
    padding: 12,
    gap: 10,
  },
  notificationsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationsActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationsIconAction: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationsTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  notificationsActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  notificationsActionButton: {
    paddingHorizontal: 4,
  },
  notificationsMenu: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  notificationsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  notificationsMenuItemText: {
    fontSize: 13,
    fontWeight: "600",
  },
  notificationsList: {
    paddingBottom: 6,
  },
  notificationsLoadingWrap: {
    paddingVertical: 14,
    alignItems: "center",
  },
  notificationsEmpty: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 14,
  },
  notificationItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  notificationItemTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  notificationItemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  notificationItemMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  notificationItemMeta: {
    fontSize: 11,
  },
  swipeBackground: {
    position: "absolute",
    inset: 0,
    borderRadius: 10,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 20,
  },
});