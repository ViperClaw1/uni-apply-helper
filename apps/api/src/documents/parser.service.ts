import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Prisma } from '@prisma/client';
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
      this.configService.get<string>('GEMINI_DOCUMENT_MODEL') || 'gemini-2.5-flash';
  }

  async parseDocument(documentId: string): Promise<StudentDocumentResponse> {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document "${documentId}" was not found.`);
    }

    if (!this.gemini) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured.');
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

      return this.toResponse(updatedDocument);
    } catch (error) {
      await this.prisma.studentDocument.update({
        where: { id: documentId },
        data: {
          parseStatus: 'failed',
          parsedData: {
            error: error instanceof Error ? error.message : 'Unknown parse error',
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
    const response = await this.gemini!.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Extract structured data from this student application document.',
                `Document type: ${document.type}`,
                'Return only valid JSON. Do not wrap it in markdown.',
              ].join('\n'),
            },
            source,
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    return this.parseJsonObject(response.text ?? '');
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

