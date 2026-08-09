import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import {
  getStepLabel,
  getStepStatusLabel,
} from "./step-labels";

export { getStepLabel, getStepStatusLabel };

/** Pull a short human message out of raw API/JSON error blobs. */
export function formatErrorMessage(raw: string, t: Dictionary): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return t.applications.errors.unknown;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const extracted = extractMessage(parsed);
    if (extracted) {
      return humanizeKnownErrors(extracted, t);
    }
  } catch {
    // not JSON — fall through
  }

  const nestedJson = trimmed.match(/\{[\s\S]*"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (nestedJson?.[1]) {
    return humanizeKnownErrors(nestedJson[1].replace(/\\"/g, '"'), t);
  }

  return humanizeKnownErrors(trimmed, t);
}

function extractMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? value : null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.message === "string") {
    return record.message;
  }

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") {
      return nested.message;
    }
  }

  return null;
}

function humanizeKnownErrors(message: string, t: Dictionary): string {
  const lower = message.toLowerCase();

  if (lower.includes("exceeded your current quota") || lower.includes("quota")) {
    return t.applications.errors.quota;
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return t.applications.errors.rateLimit;
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return t.applications.errors.timeout;
  }

  if (message.length > 180) {
    return `${message.slice(0, 177)}…`;
  }

  return message;
}
