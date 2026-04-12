/**
 * Client-side input sanitization helpers.
 *
 * Security model: server validation is the source of truth.
 * These helpers improve UX and reduce malformed requests by cleaning obvious
 * junk before it leaves the app.
 */

const NULL_BYTE_REGEX = /\0/g;
const CONTROL_CHARS_SINGLE_LINE_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CONTROL_CHARS_MULTI_LINE_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeSingleLineInput(value: string, maxLength: number): string {
  return value
    .replace(NULL_BYTE_REGEX, "")
    .replace(CONTROL_CHARS_SINGLE_LINE_REGEX, "")
    .slice(0, maxLength);
}

export function sanitizeMultiLineInput(value: string, maxLength: number): string {
  return value
    .replace(NULL_BYTE_REGEX, "")
    .replace(CONTROL_CHARS_MULTI_LINE_REGEX, "")
    .slice(0, maxLength);
}

export function sanitizeIdentifierInput(value: string): string {
  const cleaned = sanitizeSingleLineInput(value, 320);

  // If it looks like an email, keep the format as entered (minus unsafe chars).
  if (cleaned.includes("@")) {
    return cleaned;
  }

  // If user is typing letters (e.g. email local-part before '@'), do not coerce to phone yet.
  if (/[a-zA-Z]/.test(cleaned)) {
    return cleaned;
  }

  // For phone-style identifiers, keep digits and a leading +.
  const hasPlus = cleaned.startsWith("+");
  const digits = cleaned.replace(/\D+/g, "").slice(0, 15);
  return hasPlus ? `+${digits}` : digits.slice(0, 10);
}

export function sanitizeOtpInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 6);
}

export function sanitizeSearchInput(value: string): string {
  return sanitizeSingleLineInput(value, 200);
}

export function sanitizeProfileUserName(value: string): string {
  return sanitizeSingleLineInput(value, 50);
}

export function sanitizeEmailInput(value: string): string {
  return sanitizeSingleLineInput(value, 320);
}

export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 15);
}

export function sanitizeTitleInput(value: string): string {
  return sanitizeSingleLineInput(value, 150);
}

export function sanitizeDescriptionInput(value: string): string {
  return sanitizeMultiLineInput(value, 5000);
}

export function sanitizeLocationNameInput(value: string): string {
  return sanitizeSingleLineInput(value, 200);
}

export function sanitizeMoneyInput(value: string): string {
  // Only digits and at most one decimal separator.
  const cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) {
    return cleaned;
  }
  const before = cleaned.slice(0, firstDot + 1);
  const after = cleaned.slice(firstDot + 1).replace(/\./g, "");
  return `${before}${after}`;
}

export function sanitizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const cleaned = sanitizeMultiLineInput(value, maxLength);
  return cleaned.length > 0 ? cleaned : undefined;
}