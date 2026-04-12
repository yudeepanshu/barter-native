import { useEffect } from "react";
import type { RealtimeToastScope } from "@/lib/realtime/realtimeToastScopeStore";
import { useRealtimeToastScopeStore } from "@/lib/realtime/realtimeToastScopeStore";

export function useRealtimeToastScope(scope: RealtimeToastScope) {
  useEffect(() => {
    useRealtimeToastScopeStore.getState().setScope(scope);

    return () => {
      const current = useRealtimeToastScopeStore.getState().scope;
      if (current.type === scope.type) {
        if (scope.type === "none") {
          useRealtimeToastScopeStore.getState().clearScope();
          return;
        }

        if (scope.type === "request" && current.type === "request" && current.requestId === scope.requestId) {
          useRealtimeToastScopeStore.getState().clearScope();
          return;
        }

        if (scope.type === "product" && current.type === "product" && current.productId === scope.productId) {
          useRealtimeToastScopeStore.getState().clearScope();
        }
      }
    };
  }, [scope.type, scope.type === "request" ? scope.requestId : null, scope.type === "request" ? scope.productId : null, scope.type === "product" ? scope.productId : null]);
}
