import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/client";
import { invalidateNotifications } from "@/lib/query/mutationSync";

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const envelope = await mobileApiClient.markNotificationRead(notificationId);
      return envelope.data ?? null;
    },
    onSuccess: async () => {
      await invalidateNotifications(queryClient);
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const envelope = await mobileApiClient.markAllNotificationsRead();
      return envelope.data ?? null;
    },
    onSuccess: async () => {
      await invalidateNotifications(queryClient);
    },
  });
}

export function useClearAllNotificationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const envelope = await mobileApiClient.clearAllNotifications();
      return envelope.data ?? null;
    },
    onSuccess: async () => {
      await invalidateNotifications(queryClient);
    },
  });
}