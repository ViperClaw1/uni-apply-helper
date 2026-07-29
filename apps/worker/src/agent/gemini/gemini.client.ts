import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

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

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly gemini?: GoogleGenAI;
  private readonly model: string;
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
      try {
        const response = await this.gemini!.models.generateContent({
          model,
          contents: [{ role: 'user', parts: options.parts }],
          config: {
            temperature: options.temperature,
            responseMimeType: 'application/json',
          },
        });

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
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  private getModelCandidates(): string[] {
    if (this.resolvedModel) {
      return [this.resolvedModel];
    }

    const configured = this.model;
    const fallbacks = GEMINI_AGENT_MODEL_FALLBACKS.filter(
      (model) => model !== configured,
    );
    const isLegacyModel = /gemini-2\.[05]|gemini-1\.5/.test(configured);

    // Legacy/dead models first-fail for new keys — try modern IDs first.
    return isLegacyModel
      ? [...fallbacks, configured]
      : [configured, ...fallbacks];
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
