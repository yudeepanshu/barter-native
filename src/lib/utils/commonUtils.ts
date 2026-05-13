

export function getFirstName(fullName: string | null | undefined): string {
  const defaultName = "Flippe-r";
  if (typeof fullName !== "string") {
    return defaultName;
  }

  // Trim and normalize whitespace
  const cleaned = fullName.trim().replace(/\s+/g, " ");

  // Empty string check
  if (!cleaned) {
    return defaultName;
  }

  // Split into parts
  const parts = cleaned.split(" ");

  // Extra safety: ensure first part exists and is valid
  const firstName = parts[0];

  // Optional: validate it's alphabetic (allows hyphen & apostrophe)
  if (!/^[a-zA-Z'-]+$/.test(firstName)) {
    return defaultName;
  }

  return firstName;
}

export function getOfferTypeLabel(type: string) {
  switch (type) {
    case "MIXED":
      return "CASH + TRADE";
    case "PRODUCT":
      return "TRADE";
    case "MONEY":
      return "CASH";
    default:
      return type;
  }
}

export function formatTimeAgo(timestamp?: string): string {
  if (!timestamp) return "Just now";

  const createdTime = new Date(timestamp).getTime();
  if (Number.isNaN(createdTime)) return "Just now";

  const elapsedMs = Date.now() - createdTime;
  if (elapsedMs <= 0) return "Just now";

  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
