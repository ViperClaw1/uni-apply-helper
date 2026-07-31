import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

type GenerateJsonOptions = {
  prompt: string;
  screenshotBase64?: string;
  temperature?: number;
};

/** Prefer current models — gemini-2.5-* returns 404 for new API keys. */
const GEMINI_AGENT_MODEL_FALLBACKS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

const QUOTA_MAX_RETRIES_PER_MODEL = 2;
const THINKING_LEVELS = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
} as const;

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly gemini?: GoogleGenAI;
  private readonly model: string;
  private readonly thinkingLevel: ThinkingLevel;
  private resolvedModel?: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey) {
      this.gemini = new GoogleGenAI({ apiKey });
    }

    this.model =
      this.configService.get<string>('GEMINI_AGENT_MODEL') ||
      this.configService.get<string>('GEMINI_DOCUMENT_MODEL') ||
      'gemini-3.5-flash';

    const configuredThinking =
      this.configService
        .get<string>('GEMINI_AGENT_THINKING_LEVEL')
        ?.trim()
        .toLowerCase() ?? 'minimal';
    this.thinkingLevel =
      THINKING_LEVELS[configuredThinking as keyof typeof THINKING_LEVELS] ??
      ThinkingLevel.MINIMAL;
  }

  isAvailable(): boolean {
    return Boolean(this.gemini);
  }

  async generateJson<T>(options: GenerateJsonOptions): Promise<T> {
    if (!this.gemini) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> =
      [{ text: options.prompt }];

    if (options.screenshotBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: options.screenshotBase64,
        },
      });
    }

    const response = await this.generateContentWithFallback({
      parts,
      temperature: options.temperature ?? 0.1,
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return parseJsonResponse<T>(text);
  }

  private async generateContentWithFallback(options: {
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    temperature: number;
  }) {
    let lastError: unknown;

    for (const model of this.getModelCandidates()) {
      for (let attempt = 1; attempt <= QUOTA_MAX_RETRIES_PER_MODEL; attempt += 1) {
        try {
          const response = await this.gemini!.models.generateContent({
            model,
            contents: [{ role: 'user', parts: options.parts }],
            config: {
              temperature: options.temperature,
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingLevel: this.thinkingLevel,
              },
            },
          });

          const usage = response.usageMetadata;
          this.logger.debug(
            `Gemini usage model=${model} thinking=${this.thinkingLevel} ` +
              `prompt=${usage?.promptTokenCount ?? 0} ` +
              `thoughts=${usage?.thoughtsTokenCount ?? 0} ` +
              `output=${usage?.candidatesTokenCount ?? 0} ` +
              `total=${usage?.totalTokenCount ?? 0}`,
          );

          if (model !== this.model) {
            this.logger.warn(
              `Gemini using "${model}" (configured GEMINI_*_MODEL="${this.model}" is legacy/unavailable). ` +
                `Set GEMINI_AGENT_MODEL=${model} to silence this.`,
            );
          }
          this.resolvedModel = model;
          return response;
        } catch (error) {
          lastError = error;

          if (this.isGeminiModelNotFoundError(error)) {
            this.logger.warn(
              `Gemini model "${model}" not found, trying next fallback.`,
            );
            this.resolvedModel = undefined;
            break;
          }

          if (this.isGeminiQuotaError(error)) {
            const delayMs = this.getRetryDelayMs(error);
            this.logger.warn(
              `Gemini quota on "${model}" (attempt ${attempt}/${QUOTA_MAX_RETRIES_PER_MODEL}), ` +
                `retry in ${Math.ceil(delayMs / 1000)}s then try next model if needed.`,
            );
            this.resolvedModel = undefined;
            if (attempt < QUOTA_MAX_RETRIES_PER_MODEL && delayMs > 0) {
              await this.delay(Math.min(delayMs, 60_000));
              continue;
            }
            // Exhausted retries on this model — try next (separate free-tier bucket).
            break;
          }

          throw error;
        }
      }
    }

    throw lastError;
  }

  private getModelCandidates(): string[] {
    // Don't pin forever after a success — quota may kill that model mid-batch.
    const preferred = this.resolvedModel;
    const configured = this.model;
    const fallbacks = GEMINI_AGENT_MODEL_FALLBACKS.filter(
      (model) => model !== configured && model !== preferred,
    );
    const isLegacyModel = /gemini-2\.[05]|gemini-1\.5/.test(configured);

    const ordered = isLegacyModel
      ? [...fallbacks, configured]
      : [configured, ...fallbacks];

    if (preferred && !ordered.includes(preferred)) {
      return [preferred, ...ordered];
    }
    if (preferred) {
      return [preferred, ...ordered.filter((m) => m !== preferred)];
    }
    return ordered;
  }

  private isGeminiModelNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = err.status ?? err.statusCode;
    if (status === 404) {
      return true;
    }

    const message =
      err.message ?? (error instanceof Error ? error.message : String(error));

    return (
      /NOT_FOUND/i.test(message) ||
      /no longer available/i.test(message) ||
      /is not found for API version/i.test(message)
    );
  }

  private isGeminiQuotaError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = err.status ?? err.statusCode;
    if (status === 429) {
      return true;
    }

    const message =
      err.message ?? (error instanceof Error ? error.message : String(error));

    return (
      /RESOURCE_EXHAUSTED/i.test(message) ||
      /exceeded your current quota/i.test(message) ||
      /rate.?limit/i.test(message) ||
      /Quota exceeded/i.test(message)
    );
  }

  /** Parse RetryInfo.retryDelay like "33s" or "33.14s" from Gemini error JSON. */
  private getRetryDelayMs(error: unknown): number {
    const message =
      error instanceof Error ? error.message : String(error ?? '');

    const retryInfo = message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
    if (retryInfo?.[1]) {
      const seconds = Number(retryInfo[1]);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds * 1000) + 500;
      }
    }

    const pleaseRetry = message.match(/Please retry in ([\d.]+)s/i);
    if (pleaseRetry?.[1]) {
      const seconds = Number(pleaseRetry[1]);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds * 1000) + 500;
      }
    }

    return 35_000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function parseJsonResponse<T>(raw: string): T {
  const candidates = collectJsonCandidates(raw);
  let lastError: unknown;

  for (const candidate of candidates) {
    for (const variant of [candidate, repairGeminiJson(candidate)]) {
      try {
        return JSON.parse(variant) as T;
      } catch (error) {
        lastError = error;
      }
    }
  }

  const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
  throw new Error(
    `Failed to parse Gemini JSON: ${lastError instanceof Error ? lastError.message : 'unknown error'}` +
      (preview ? ` Raw preview: ${preview}` : ''),
  );
}

function collectJsonCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const out: string[] = [];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) out.push(fenced);
  out.push(trimmed);
  const object = extractBalancedJson(trimmed, '{', '}');
  if (object) out.push(object);
  return [...new Set(out.filter(Boolean))];
}

/**
 * Gemini sometimes emits invalid JSON even with responseMimeType=json:
 * - trailing commas
 * - bare ISO datetimes
 * - unquoted string values that contain commas (school names)
 * - truncated responses (missing closing braces)
 */
function repairGeminiJson(raw: string): string {
  let s = raw
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(
      /:\s*(\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+)(?=\s*[,}\]])/g,
      ': "$1"',
    )
    .replace(/:\s*(\d{4}-\d{2}-\d{2})(?=\s*[,}\]])/g, ': "$1"');

  // Quote bare identifier / prose values: `"key": School Name, City` → quoted
  s = s.replace(
    /:\s*(?!["{\[\d]|true\b|false\b|null\b)([^,\n}\]]+(?:,[^,\n}\]]+)*)/g,
    (match, value: string) => {
      const trimmed = value.trim();
      if (!trimmed || /^["{\[\d]|^(true|false|null)$/i.test(trimmed)) {
        return match;
      }
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
        return match;
      }
      const escaped = trimmed
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      return `: "${escaped}"`;
    },
  );

  return closeTruncatedJson(s);
}

/** Close cut-off Gemini JSON: unclosed strings / braces / brackets. */
function closeTruncatedJson(raw: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      stack.pop();
    }
  }

  let out = raw;
  if (inString) {
    out += '"';
  }
  // Drop dangling comma before we close
  out = out.replace(/,\s*$/, '');
  while (stack.length) {
    const open = stack.pop();
    out += open === '{' ? '}' : ']';
  }
  return out;
}

function extractBalancedJson(
  raw: string,
  open: '{' | '[',
  close: '}' | ']',
): string | null {
  const start = raw.indexOf(open);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}
