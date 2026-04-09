import { io, type Socket } from "socket.io-client";
import { useRealtimeDiagnosticsStore } from "@/lib/realtime/realtimeDiagnosticsStore";

const DEFAULT_API_BASE_URL = "https://barter-backend-6ypo.onrender.com/api";

const SOCKET_EVENT = "realtime:event";

function deriveSocketBaseUrl() {
  const explicitSocketUrl = process.env.EXPO_PUBLIC_SOCKET_BASE_URL;
  if (explicitSocketUrl) {
    return explicitSocketUrl;
  }

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  return apiBaseUrl.replace(/\/api\/?$/, "");
}

export type RealtimeEventHandler = (event: unknown) => void;

class RealtimeClient {
  private socket: Socket | null = null;

  private currentToken: string | null = null;

  private handlers = new Set<RealtimeEventHandler>();

  connect(accessToken: string) {
    if (!accessToken) {
      return;
    }

    if (this.socket && this.currentToken === accessToken && this.socket.connected) {
      return;
    }

    if (this.socket && this.currentToken !== accessToken) {
      this.disconnect();
    }

    this.currentToken = accessToken;
    useRealtimeDiagnosticsStore.getState().markConnecting();

    const socket = io(deriveSocketBaseUrl(), {
      autoConnect: false,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 5000,
      auth: {
        token: accessToken,
      },
    });

    socket.on(SOCKET_EVENT, (event: unknown) => {
      useRealtimeDiagnosticsStore.getState().markEventReceived();
      this.handlers.forEach((handler) => {
        handler(event);
      });
    });

    socket.on("connect", () => {
      useRealtimeDiagnosticsStore.getState().markConnected();
    });

    socket.on("disconnect", (reason) => {
      useRealtimeDiagnosticsStore.getState().markDisconnected(reason);
    });

    socket.io.on("reconnect_attempt", () => {
      useRealtimeDiagnosticsStore.getState().markReconnectAttempt();
    });

    this.socket = socket;
    socket.connect();
  }

  disconnect() {
    if (!this.socket) {
      this.currentToken = null;
      return;
    }

    this.socket.removeAllListeners();
    this.socket.io.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.currentToken = null;
  }

  subscribe(handler: RealtimeEventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  joinProductRoom(productId: string) {
    this.socket?.emit("realtime:join:product", { productId });
  }

  leaveProductRoom(productId: string) {
    this.socket?.emit("realtime:leave:product", { productId });
  }

  joinRequestRoom(requestId: string) {
    this.socket?.emit("realtime:join:request", { requestId });
  }

  leaveRequestRoom(requestId: string) {
    this.socket?.emit("realtime:leave:request", { requestId });
  }

  joinTransactionRoom(transactionId: string) {
    this.socket?.emit("realtime:join:transaction", { transactionId });
  }

  leaveTransactionRoom(transactionId: string) {
    this.socket?.emit("realtime:leave:transaction", { transactionId });
  }
}

export const realtimeClient = new RealtimeClient();
