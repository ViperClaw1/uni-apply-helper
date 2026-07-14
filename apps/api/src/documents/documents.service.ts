import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Prisma } from '@uni-apply/database';
import { QUEUES } from '@uni-apply/shared';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import type {
  CreateDocumentInput,
  DocumentParseJobData,
  StudentDocumentResponse,
  UpdateDocumentInput,
  UploadedDocumentFile,
} from './types/document-api.types.js';

type StudentDocumentRecord = {
  id: string;
  studentId: string;
  type: string;
  fileUrl: string;
  parsedData: unknown;
  parseStatus: string;
  uploadedAt: Date;
};

const PARSEABLE_DOCUMENT_TYPES = new Set(['passport']);

@Injectable()
export class DocumentsService {
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly publicUrl?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {
    this.bucket = this.configService.get<string>('R2_BUCKET');
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL');

    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: this.configService.get<string>('R2_REGION') ?? 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  async findByStudent(studentId: string): Promise<StudentDocumentResponse[]> {
    await this.ensureStudentExists(studentId);

    const documents = await this.prisma.studentDocument.findMany({
      where: { studentId },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents.map((document) => this.toResponse(document));
  }

  async findOne(id: string): Promise<StudentDocumentResponse> {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Document "${id}" was not found.`);
    }

    return this.toResponse(document);
  }

  async create(
    studentId: string,
    input: CreateDocumentInput,
  ): Promise<StudentDocumentResponse> {
    await this.ensureStudentExists(studentId);
    this.assertDocumentInput(input);

    const documentType = input.type.trim();
    const parseStatus = this.getInitialParseStatus(
      documentType,
      input.parseStatus,
    );

    const document = await this.prisma.studentDocument.create({
      data: {
        studentId,
        type: documentType,
        fileUrl: input.fileUrl.trim(),
        parsedData: this.toJsonInput(input.parsedData),
        parseStatus,
      },
    });

    if (document.parseStatus === 'pending') {
      await this.enqueueParse(document.id);
    }

    return this.toResponse(document);
  }

  async upload(
    studentId: string,
    type: string | undefined,
    file: UploadedDocumentFile | undefined,
  ): Promise<StudentDocumentResponse> {
    await this.ensureStudentExists(studentId);

    if (!type?.trim()) {
      throw new BadRequestException('Document type is required.');
    }

    if (!file) {
      throw new BadRequestException('Document file is required.');
    }

    const fileUrl = await this.uploadToStorage(studentId, type, file);

    return this.create(studentId, {
      type,
      fileUrl,
    });
  }

  async update(
    id: string,
    input: UpdateDocumentInput,
  ): Promise<StudentDocumentResponse> {
    await this.findOne(id);

    const data: Prisma.StudentDocumentUpdateInput = {};

    if (input.type !== undefined) {
      if (!input.type.trim()) {
        throw new BadRequestException('Document type cannot be empty.');
      }

      data.type = input.type.trim();
    }

    if (input.fileUrl !== undefined) {
      if (!input.fileUrl.trim()) {
        throw new BadRequestException('Document fileUrl cannot be empty.');
      }

      data.fileUrl = input.fileUrl.trim();
    }

    if (input.parsedData !== undefined) {
      data.parsedData = this.toJsonInput(input.parsedData);
    }

    if (input.parseStatus !== undefined) {
      data.parseStatus = input.parseStatus;
    }

    const document = await this.prisma.studentDocument.update({
      where: { id },
      data,
    });

    return this.toResponse(document);
  }

  async remove(id: string): Promise<StudentDocumentResponse> {
    await this.findOne(id);

    const document = await this.prisma.studentDocument.delete({
      where: { id },
    });

    return this.toResponse(document);
  }

  private async ensureStudentExists(studentId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException(`Student "${studentId}" was not found.`);
    }
  }

  private assertDocumentInput(input: CreateDocumentInput): void {
    if (!input.type?.trim()) {
      throw new BadRequestException('Document type is required.');
    }

    if (!input.fileUrl?.trim()) {
      throw new BadRequestException('Document fileUrl is required.');
    }
  }

  private async uploadToStorage(
    studentId: string,
    type: string,
    file: UploadedDocumentFile,
  ): Promise<string> {
    if (!this.s3 || !this.bucket || !this.publicUrl) {
      throw new ServiceUnavailableException('R2 storage is not configured.');
    }

    const extension = extname(file.originalname);
    const key = [
      'students',
      studentId,
      'documents',
      `${this.slugify(type)}-${randomUUID()}${extension}`,
    ].join('/');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  private async enqueueParse(documentId: string): Promise<void> {
    const data: DocumentParseJobData = { documentId };

    await this.queueService.addJob(QUEUES.DOCUMENT_PARSE, data, {
      jobId: documentId,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  private getInitialParseStatus(
    documentType: string,
    requestedStatus: CreateDocumentInput['parseStatus'],
  ): string {
    if (!PARSEABLE_DOCUMENT_TYPES.has(documentType)) {
      return 'uploaded';
    }

    return requestedStatus ?? 'pending';
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
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

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
