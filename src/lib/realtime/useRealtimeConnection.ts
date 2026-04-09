import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth/authStore";
import { handleRealtimeEvent } from "@/lib/realtime/eventHandlers";
import { realtimeClient } from "@/lib/realtime/socketClient";

export function useRealtimeConnection() {
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.session?.tokens.accessToken ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((event) => {
      handleRealtimeEvent(event, queryClient);
    });

    return unsubscribe;
  }, [queryClient]);

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
