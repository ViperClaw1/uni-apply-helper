import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Prisma } from '@uni-apply/database';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StudentDocumentResponse } from './types/document-api.types.js';

type StudentDocumentRecord = {
  id: string;
  studentId: string;
  type: string;
  fileUrl: string;
  parsedData: unknown;
  parseStatus: string;
  uploadedAt: Date;
};

const GEMINI_MAX_RETRIES = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 5000;

const DOCUMENT_PARSE_PROMPTS: Record<string, string> = {
  passport: [
    'Extract from this passport scan: surname, givenName, dateOfBirth,',
    'nationality, passportNo, passportExpiry, cityOfBirth.',
    'Return JSON only.',
  ].join(' '),
};

@Injectable()
export class ParserService {
  private readonly gemini?: GoogleGenAI;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey) {
      this.gemini = new GoogleGenAI({ apiKey });
    }

    this.model =
      this.configService.get<string>('GEMINI_DOCUMENT_MODEL') ||
      'gemini-3.5-flash';
  }

  async parseDocument(documentId: string): Promise<StudentDocumentResponse> {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document "${documentId}" was not found.`);
    }

    if (!this.isParseableDocument(document.type)) {
      throw new BadRequestException(
        `Document type "${document.type}" does not support parsing.`,
      );
    }

    if (!this.gemini) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured.',
      );
    }

    await this.prisma.studentDocument.update({
      where: { id: documentId },
      data: { parseStatus: 'processing' },
    });

    try {
      const parsedData = await this.parseWithGemini(document);
      const updatedDocument = await this.prisma.studentDocument.update({
        where: { id: documentId },
        data: {
          parsedData: parsedData as Prisma.InputJsonValue,
          parseStatus: 'parsed',
        },
      });

      if (document.type === 'passport') {
        await this.updateEmptyStudentPassportFields(
          document.studentId,
          parsedData,
        );
      }

      return this.toResponse(updatedDocument);
    } catch (error) {
      await this.prisma.studentDocument.update({
        where: { id: documentId },
        data: {
          parseStatus: 'failed',
          parsedData: {
            error:
              error instanceof Error ? error.message : 'Unknown parse error',
          },
        },
      });

      throw error;
    }
  }

  private async parseWithGemini(
    document: StudentDocumentRecord,
  ): Promise<Record<string, unknown>> {
    const source = await this.fetchDocumentSource(document.fileUrl);

    try {
      const response = await this.generateGeminiContent([
        {
          role: 'user',
          parts: [
            {
              text: [
                this.getParsePrompt(document.type),
                `Document type: ${document.type}`,
                'Return only valid JSON. Do not wrap it in markdown.',
              ].join('\n'),
            },
            source,
          ],
        },
      ]);

      return this.parseJsonObject(response.text ?? '');
    } catch (error) {
      throw this.toGeminiUnavailableException(error);
    }
  }

  private async generateGeminiContent(
    contents: Parameters<
      NonNullable<typeof this.gemini>['models']['generateContent']
    >[0]['contents'],
  ) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
      try {
        return await this.gemini!.models.generateContent({
          model: this.model,
          contents,
          config: {
            responseMimeType: 'application/json',
          },
        });
      } catch (error) {
        lastError = error;

        if (
          attempt === GEMINI_MAX_RETRIES ||
          !this.isGeminiOverloadedError(error)
        ) {
          throw error;
        }

        await this.delay(GEMINI_RETRY_BASE_DELAY_MS * attempt);
      }
    }

    throw lastError;
  }

  private isGeminiOverloadedError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = err.status ?? err.statusCode;

    if (status === 503) {
      return true;
    }

    const message =
      err.message ?? (error instanceof Error ? error.message : '');

    return message.includes('503') || message.includes('UNAVAILABLE');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toGeminiUnavailableException(
    error: unknown,
  ): ServiceUnavailableException {
    const message =
      error instanceof Error ? error.message : 'Unknown Gemini error';

    return new ServiceUnavailableException(
      `Gemini document parsing failed for model "${this.model}": ${message}`,
    );
  }

  private isParseableDocument(documentType: string): boolean {
    return DOCUMENT_PARSE_PROMPTS[documentType] !== undefined;
  }

  private getParsePrompt(documentType: string): string {
    const prompt = DOCUMENT_PARSE_PROMPTS[documentType];

    if (!prompt) {
      throw new BadRequestException(
        `Document type "${documentType}" does not support parsing.`,
      );
    }

    return prompt;
  }

  private async updateEmptyStudentPassportFields(
    studentId: string,
    parsedData: Record<string, unknown>,
  ): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        surname: true,
        givenName: true,
        nationality: true,
        cityOfBirth: true,
        dateOfBirth: true,
        passportNo: true,
        passportExpiry: true,
      },
    });

    if (!student) {
      return;
    }

    const data: Prisma.StudentUpdateInput = {};
    const surname = this.readString(parsedData, 'surname');
    const givenName = this.readString(parsedData, 'givenName');
    const nationality = this.readString(parsedData, 'nationality');
    const cityOfBirth = this.readString(parsedData, 'cityOfBirth');
    const passportNo = this.readString(parsedData, 'passportNo');
    const dateOfBirth = this.readDate(parsedData, 'dateOfBirth');
    const passportExpiry = this.readDate(parsedData, 'passportExpiry');

    if (!student.surname && surname) {
      data.surname = surname;
    }

    if (!student.givenName && givenName) {
      data.givenName = givenName;
    }

    if (!student.nationality && nationality) {
      data.nationality = nationality;
    }

    if (!student.cityOfBirth && cityOfBirth) {
      data.cityOfBirth = cityOfBirth;
    }

    if (!student.passportNo && passportNo) {
      data.passportNo = passportNo;
    }

    if (!student.dateOfBirth && dateOfBirth) {
      data.dateOfBirth = dateOfBirth;
    }

    if (!student.passportExpiry && passportExpiry) {
      data.passportExpiry = passportExpiry;
    }

    if (Object.keys(data).length === 0) {
      return;
    }

    await this.prisma.student.update({
      where: { id: studentId },
      data,
    });
  }

  private readString(
    data: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = data[key];

    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readDate(
    data: Record<string, unknown>,
    key: string,
  ): Date | undefined {
    const value = this.readString(data, key);

    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private async fetchDocumentSource(fileUrl: string) {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status}`);
    }

    const mimeType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const data = Buffer.from(await response.arrayBuffer()).toString('base64');

    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }

  private parseJsonObject(text: string): Record<string, unknown> {
    const normalizedText = this.stripMarkdownFence(text);
    const parsed = JSON.parse(normalizedText) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Gemini response is not a JSON object.');
    }

    return parsed as Record<string, unknown>;
  }

  private stripMarkdownFence(text: string): string {
    return text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
  }

  private toResponse(document: StudentDocumentRecord): StudentDocumentResponse {
    return {
      id: document.id,
      studentId: document.studentId,
      type: document.type,
      fileUrl: document.fileUrl,
      parsedData: document.parsedData ?? undefined,
      parseStatus: document.parseStatus,
      uploadedAt: document.uploadedAt.toISOString(),
    };
  }
}
