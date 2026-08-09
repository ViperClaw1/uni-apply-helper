"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const shared_1 = require("@uni-apply/shared");
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const queue_service_js_1 = require("../queue/queue.service.js");
const PARSEABLE_DOCUMENT_TYPES = new Set(['passport']);
let DocumentsService = class DocumentsService {
    prisma;
    configService;
    queueService;
    s3;
    bucket;
    publicUrl;
    constructor(prisma, configService, queueService) {
        this.prisma = prisma;
        this.configService = configService;
        this.queueService = queueService;
        this.bucket = this.configService.get('R2_BUCKET');
        this.publicUrl = this.configService.get('R2_PUBLIC_URL');
        const endpoint = this.configService.get('R2_ENDPOINT');
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
        if (endpoint && accessKeyId && secretAccessKey) {
            this.s3 = new client_s3_1.S3Client({
                region: this.configService.get('R2_REGION') ?? 'auto',
                endpoint,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
        }
    }
    async findByStudent(studentId) {
        await this.ensureStudentExists(studentId);
        const documents = await this.prisma.studentDocument.findMany({
            where: { studentId },
            orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { uploadedAt: 'asc' }],
        });
        return documents.map((document) => this.toResponse(document));
    }
    async findOne(id) {
        const document = await this.prisma.studentDocument.findUnique({
            where: { id },
        });
        if (!document) {
            throw new common_1.NotFoundException(`Document "${id}" was not found.`);
        }
        return this.toResponse(document);
    }
    async create(studentId, input) {
        await this.ensureStudentExists(studentId);
        this.assertDocumentInput(input);
        const documentType = input.type.trim();
        const parseStatus = this.getInitialParseStatus(documentType, input.parseStatus);
        const maxOrder = await this.prisma.studentDocument.aggregate({
            where: { studentId, type: documentType },
            _max: { sortOrder: true },
        });
        const sortOrder = input.sortOrder ??
            (maxOrder._max.sortOrder === null || maxOrder._max.sortOrder === undefined
                ? 0
                : maxOrder._max.sortOrder + 1);
        const document = await this.prisma.studentDocument.create({
            data: {
                studentId,
                type: documentType,
                fileUrl: input.fileUrl.trim(),
                parsedData: this.toJsonInput(input.parsedData),
                parseStatus,
                sortOrder,
            },
        });
        if (document.parseStatus === 'pending') {
            await this.enqueueParse(document.id);
        }
        return this.toResponse(document);
    }
    async upload(studentId, type, file) {
        await this.ensureStudentExists(studentId);
        if (!type?.trim()) {
            throw new common_1.BadRequestException('Document type is required.');
        }
        if (!file) {
            throw new common_1.BadRequestException('Document file is required.');
        }
        const fileUrl = await this.uploadToStorage(studentId, type, file);
        return this.create(studentId, {
            type,
            fileUrl,
        });
    }
    async update(id, input) {
        await this.findOne(id);
        const data = {};
        if (input.type !== undefined) {
            if (!input.type.trim()) {
                throw new common_1.BadRequestException('Document type cannot be empty.');
            }
            data.type = input.type.trim();
        }
        if (input.fileUrl !== undefined) {
            if (!input.fileUrl.trim()) {
                throw new common_1.BadRequestException('Document fileUrl cannot be empty.');
            }
            data.fileUrl = input.fileUrl.trim();
        }
        if (input.parsedData !== undefined) {
            data.parsedData = this.toJsonInput(input.parsedData);
        }
        if (input.parseStatus !== undefined) {
            data.parseStatus = input.parseStatus;
        }
        if (input.sortOrder !== undefined) {
            data.sortOrder = input.sortOrder;
        }
        const document = await this.prisma.studentDocument.update({
            where: { id },
            data,
        });
        return this.toResponse(document);
    }
    async reorder(studentId, input) {
        await this.ensureStudentExists(studentId);
        const type = input.type?.trim();
        const orderedIds = input.orderedIds ?? [];
        if (!type) {
            throw new common_1.BadRequestException('Document type is required.');
        }
        if (orderedIds.length === 0) {
            throw new common_1.BadRequestException('orderedIds cannot be empty.');
        }
        const existing = await this.prisma.studentDocument.findMany({
            where: { studentId, type },
            select: { id: true },
        });
        const existingIds = new Set(existing.map((doc) => doc.id));
        if (existingIds.size !== orderedIds.length) {
            throw new common_1.BadRequestException('orderedIds must include every document of this type exactly once.');
        }
        for (const id of orderedIds) {
            if (!existingIds.has(id)) {
                throw new common_1.BadRequestException(`Document "${id}" does not belong to type "${type}".`);
            }
        }
        await this.prisma.$transaction(orderedIds.map((id, index) => this.prisma.studentDocument.update({
            where: { id },
            data: { sortOrder: index },
        })));
        return this.findByStudent(studentId).then((docs) => docs.filter((doc) => doc.type === type));
    }
    async remove(id) {
        const existing = await this.prisma.studentDocument.findUnique({
            where: { id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Document "${id}" was not found.`);
        }
        await this.deleteFromStorage(existing.fileUrl);
        const document = await this.prisma.studentDocument.delete({
            where: { id },
        });
        await this.normalizeSortOrder(document.studentId, document.type);
        return this.toResponse(document);
    }
    async normalizeSortOrder(studentId, type) {
        const remaining = await this.prisma.studentDocument.findMany({
            where: { studentId, type },
            orderBy: [{ sortOrder: 'asc' }, { uploadedAt: 'asc' }],
            select: { id: true },
        });
        if (remaining.length === 0) {
            return;
        }
        await this.prisma.$transaction(remaining.map((doc, index) => this.prisma.studentDocument.update({
            where: { id: doc.id },
            data: { sortOrder: index },
        })));
    }
    async ensureStudentExists(studentId) {
        const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true },
        });
        if (!student) {
            throw new common_1.NotFoundException(`Student "${studentId}" was not found.`);
        }
    }
    assertDocumentInput(input) {
        if (!input.type?.trim()) {
            throw new common_1.BadRequestException('Document type is required.');
        }
        if (!input.fileUrl?.trim()) {
            throw new common_1.BadRequestException('Document fileUrl is required.');
        }
    }
    async uploadToStorage(studentId, type, file) {
        if (!this.s3 || !this.bucket || !this.publicUrl) {
            throw new common_1.ServiceUnavailableException('R2 storage is not configured.');
        }
        const extension = (0, node_path_1.extname)(file.originalname);
        const key = [
            'students',
            studentId,
            'documents',
            `${this.slugify(type)}-${(0, node_crypto_1.randomUUID)()}${extension}`,
        ].join('/');
        await this.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));
        return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    async deleteFromStorage(fileUrl) {
        if (!this.s3 || !this.bucket || !this.publicUrl) {
            return;
        }
        const key = this.keyFromPublicUrl(fileUrl);
        if (!key) {
            return;
        }
        try {
            await this.s3.send(new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
        }
        catch {
        }
    }
    keyFromPublicUrl(fileUrl) {
        if (!this.publicUrl) {
            return null;
        }
        const base = this.publicUrl.replace(/\/$/, '');
        if (!fileUrl.startsWith(base + '/') && fileUrl !== base) {
            return null;
        }
        return fileUrl.slice(base.length + 1);
    }
    async enqueueParse(documentId) {
        const data = { documentId };
        await this.queueService.addJob(shared_1.QUEUES.DOCUMENT_PARSE, data, {
            jobId: documentId,
            removeOnComplete: true,
            removeOnFail: true,
        });
    }
    getInitialParseStatus(documentType, requestedStatus) {
        if (!PARSEABLE_DOCUMENT_TYPES.has(documentType)) {
            return 'uploaded';
        }
        return requestedStatus ?? 'pending';
    }
    toJsonInput(value) {
        if (value === undefined) {
            return undefined;
        }
        return value;
    }
    toResponse(document) {
        return {
            id: document.id,
            studentId: document.studentId,
            type: document.type,
            fileUrl: document.fileUrl,
            parsedData: document.parsedData ?? undefined,
            parseStatus: document.parseStatus,
            sortOrder: document.sortOrder,
            uploadedAt: document.uploadedAt.toISOString(),
        };
    }
    slugify(value) {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService, typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object, queue_service_js_1.QueueService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map