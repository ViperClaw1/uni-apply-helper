export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeFormUrl(value: string): string {
  const parsed = new URL(value.trim());
  return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
}
