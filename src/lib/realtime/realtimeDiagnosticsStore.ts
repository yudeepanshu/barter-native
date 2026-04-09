import { create } from "zustand";

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

interface RealtimeDiagnosticsState {
  connectionState: ConnectionState;
  connectedAt: string | null;
  lastEventAt: string | null;
  lastDisconnectReason: string | null;
  reconnectAttempts: number;
  connectCount: number;
  disconnectCount: number;
  eventCount: number;
  markConnecting: () => void;
  markConnected: () => void;
  markDisconnected: (reason?: string) => void;
  markReconnectAttempt: () => void;
  markEventReceived: () => void;
  reset: () => void;
}

const EMPTY_STATE = {
  connectionState: "idle" as ConnectionState,
  connectedAt: null,
  lastEventAt: null,
  lastDisconnectReason: null,
  reconnectAttempts: 0,
  connectCount: 0,
  disconnectCount: 0,
  eventCount: 0,
};

export const useRealtimeDiagnosticsStore = create<RealtimeDiagnosticsState>((set) => ({
  ...EMPTY_STATE,
  markConnecting: () => {
    set({ connectionState: "connecting" });
  },
  markConnected: () => {
    set((state) => ({
      connectionState: "connected",
      connectedAt: new Date().toISOString(),
      connectCount: state.connectCount + 1,
    }));
  },
  markDisconnected: (reason) => {
    set((state) => ({
      connectionState: "disconnected",
      lastDisconnectReason: reason ?? null,
      disconnectCount: state.disconnectCount + 1,
    }));
  },
  markReconnectAttempt: () => {
    set((state) => ({
      reconnectAttempts: state.reconnectAttempts + 1,
    }));
  },
  markEventReceived: () => {
    set((state) => ({
      eventCount: state.eventCount + 1,
      lastEventAt: new Date().toISOString(),
    }));
  },
  reset: () => {
    set(EMPTY_STATE);
  },
}));
