

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