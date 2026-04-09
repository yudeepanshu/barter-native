import { useEffect } from "react";
import { realtimeClient } from "@/lib/realtime/socketClient";

export function useProductRoom(productId: string | null | undefined) {
  useEffect(() => {
    if (!productId) {
      return;
    }

    realtimeClient.joinProductRoom(productId);

    return () => {
      realtimeClient.leaveProductRoom(productId);
    };
  }, [productId]);
}

export function useRequestRoom(requestId: string | null | undefined) {
  useEffect(() => {
    if (!requestId) {
      return;
    }

    realtimeClient.joinRequestRoom(requestId);

    return () => {
      realtimeClient.leaveRequestRoom(requestId);
    };
  }, [requestId]);
}

export function useTransactionRoom(transactionId: string | null | undefined) {
  useEffect(() => {
    if (!transactionId) {
      return;
    }

    realtimeClient.joinTransactionRoom(transactionId);

    return () => {
      realtimeClient.leaveTransactionRoom(transactionId);
    };
  }, [transactionId]);
}
