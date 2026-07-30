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
              `Gemini model "${this.model}" unavailable, used "${model}". ` +
                `Update GEMINI_AGENT_MODEL / GEMINI_DOCUMENT_MODEL.`,
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
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();

  try {
    return JSON.parse(fenced ?? trimmed) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}
