import type { DomainEventPayloadMap, DomainEventType } from "@/lib/realtime/types";
import type { RealtimeToastScope } from "@/lib/realtime/realtimeToastScopeStore";

type RealtimeToastPayload = {
  title: string;
  message?: string;
  variant?: "info" | "success" | "warning";
};

type RealtimeDomainEvent = {
  type: DomainEventType;
  payload: DomainEventPayloadMap[DomainEventType];
};

const PUSH_COVERED_REQUEST_ACTIONS = new Set<DomainEventPayloadMap["request.updated"]["action"]>([
  "CREATED",
  "COUNTERED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
  "CONTACT_REVEAL_REQUESTED",
  "CONTACT_REVEAL_RESPONDED",
]);

function isDomainEvent(value: unknown): value is RealtimeDomainEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<{
    type: DomainEventType;
    payload: DomainEventPayloadMap[DomainEventType];
  }>;
  return Boolean(candidate.type && candidate.payload);
}

function extractActorId(event: RealtimeDomainEvent): string | null {
  const payload = event.payload as { actorId?: unknown };
  return typeof payload.actorId === "string" ? payload.actorId : null;
}

function getRequestUpdateToast(payload: DomainEventPayloadMap["request.updated"]): RealtimeToastPayload | null {
  const { action, requestId } = payload;
  const requestRef = requestId.slice(-6).toUpperCase();
  const entryHint = `Request #${requestRef}`;

  switch (action) {
    // case "CREATED":
    //   return {
    //     title: "New request received",
    //     message: `${entryHint}: someone sent a fresh request on one of your listings.`,
    //     variant: "info",
    //   };
    // case "COUNTERED":
    //   return {
    //     title: "Counter offer received",
    //     message: `${entryHint}: the other party updated the offer details.`,
    //     variant: "info",
    //   };
    case "ACCEPTED":
      return {
        title: "Request accepted",
        message: `The other party accepted the current offer.`,
        variant: "success",
      };
    case "REJECTED":
      return {
        title: "Request declined",
        message: `The other party rejected this request.`,
        variant: "warning",
      };
    case "CANCELLED":
      return {
        title: "Request cancelled",
        message: `The other party cancelled this request.`,
        variant: "warning",
      };
    case "COMPLETED":
      return {
        title: "Request completed",
        message: `This exchange was marked as completed.`,
        variant: "success",
      };
    case "EXPIRED":
      return {
        title: "Request expired",
        message: `This request is no longer active.`,
        variant: "warning",
      };
    case "CONTACT_REVEAL_REQUESTED":
      return {
        title: "Contact reveal requested",
        message: `The other party requested to reveal contact details.`,
        variant: "info",
      };
    case "CONTACT_REVEAL_RESPONDED":
      return {
        title: "Contact reveal updated",
        message: `There is a new response on the contact reveal request.`,
        variant: "info",
      };
    default:
      return null;
  }
}

export function getRealtimeToastMessage(
  event: unknown,
  currentUserId: string | null,
  activeScope: RealtimeToastScope,
): RealtimeToastPayload | null {
  if (!isDomainEvent(event)) {
    return null;
  }

  if (activeScope.type === "none") {
    return null;
  }

  if (activeScope.type === "request" && event.type !== "request.updated" && event.type !== "transaction.updated") {
    return null;
  }

  if (activeScope.type === "product" && event.type !== "product.updated") {
    return null;
  }

  const actorId = extractActorId(event);
  if (currentUserId && actorId && actorId === currentUserId) {
    return null;
  }

  if (event.type === "request.updated") {
    const requestPayload = event.payload as DomainEventPayloadMap["request.updated"];

    if (PUSH_COVERED_REQUEST_ACTIONS.has(requestPayload.action)) {
      return null;
    }

    if (activeScope.type === "request" && requestPayload.requestId !== activeScope.requestId) {
      return null;
    }

    const requestActorId = requestPayload.actorId;
    if (!requestActorId) {
      return null;
    }

    return getRequestUpdateToast(requestPayload);
  }

  if (event.type === "product.updated") {
    const productPayload = event.payload as DomainEventPayloadMap["product.updated"];

    if (activeScope.type === "product" && productPayload.productId !== activeScope.productId) {
      return null;
    }

    return {
      title: "Listing updated",
      message: "This post was updated recently.",
      variant: "info",
    };
  }

  if (event.type === "transaction.updated") {
    return null;
  }

  return null;
}
