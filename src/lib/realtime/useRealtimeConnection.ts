import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth/authStore";
import { handleRealtimeEvent } from "@/lib/realtime/eventHandlers";
import { useRealtimeToastScopeStore } from "@/lib/realtime/realtimeToastScopeStore";
import { getRealtimeToastMessage } from "@/lib/realtime/toastMessages";
import { realtimeClient } from "@/lib/realtime/socketClient";
import { useTopToastStore } from "@/lib/ui/topToastStore";

export function useRealtimeConnection() {
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.session?.tokens.accessToken ?? null);
  const currentUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const activeToastScope = useRealtimeToastScopeStore((state) => state.scope);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((event) => {
      const toast = getRealtimeToastMessage(event, currentUserId, activeToastScope);
      if (toast) {
        useTopToastStore.getState().enqueueToast(toast);
      }

      handleRealtimeEvent(event, queryClient);
    });

    return unsubscribe;
  }, [activeToastScope, currentUserId, queryClient]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) {
      realtimeClient.disconnect();
      return;
    }

    realtimeClient.connect(accessToken);

    return () => {
      realtimeClient.disconnect();
    };
  }, [status, accessToken]);
}
