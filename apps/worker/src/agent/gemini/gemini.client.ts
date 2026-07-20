import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

type GenerateJsonOptions = {
  prompt: string;
  screenshotBase64?: string;
  temperature?: number;
};

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly gemini?: GoogleGenAI;
  private readonly model: string;

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

    const response = await this.gemini.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        temperature: options.temperature ?? 0.1,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return parseJsonResponse<T>(text);
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
