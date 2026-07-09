import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
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
  private readonly anthropic?: Anthropic;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }

    this.model =
      this.configService.get<string>('ANTHROPIC_DOCUMENT_MODEL') ??
      'claude-sonnet-4-5';
  }

  async parseDocument(documentId: string): Promise<StudentDocumentResponse> {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document "${documentId}" was not found.`);
    }

    if (!this.anthropic) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured.');
    }

    await this.prisma.studentDocument.update({
      where: { id: documentId },
      data: { parseStatus: 'processing' },
    });

    try {
      const parsedData = await this.parseWithClaude(document);
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

  private async parseWithClaude(
    document: StudentDocumentRecord,
  ): Promise<Record<string, unknown>> {
    const source = await this.fetchDocumentSource(document.fileUrl);
    const content = [
      {
        type: 'text',
        text: [
          'Extract structured data from this student application document.',
          `Document type: ${document.type}`,
          'Return only valid JSON. Do not wrap it in markdown.',
        ].join('\n'),
      },
      source,
    ];

    const message = await this.anthropic!.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: content as any,
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return this.parseJsonObject(text);
  }

  private async fetchDocumentSource(fileUrl: string) {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status}`);
    }

    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const data = Buffer.from(await response.arrayBuffer()).toString('base64');

    if (contentType.startsWith('image/')) {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: contentType,
          data,
        },
      };
    }

    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: contentType,
        data,
      },
    };
  }

  private parseJsonObject(text: string): Record<string, unknown> {
    const parsed = JSON.parse(text) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Claude response is not a JSON object.');
    }

    return parsed as Record<string, unknown>;
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

