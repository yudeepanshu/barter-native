export function needsProfileCompletion(userName: string | null | undefined): boolean {
  const value = (userName ?? "").trim().toLowerCase();
  return value === "new user" || value.length < 3;
}

export function validateDisplayName(name: string): string | null {
  const normalized = name.trim().replace(/\s+/g, " ");

  if (normalized.length < 3) {
    return "Name must be at least 3 characters.";
  }

  if (normalized.length > 40) {
    return "Name must be at most 40 characters.";
  }

  if (!/^[A-Za-z ]+$/.test(normalized)) {
    return "Name can contain letters and spaces only.";
  }

  return null;
}
