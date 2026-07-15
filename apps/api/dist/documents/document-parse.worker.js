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
var DocumentParseWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentParseWorker = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const bullmq_1 = require("bullmq");
const parser_service_js_1 = require("./parser.service.js");
let DocumentParseWorker = DocumentParseWorker_1 = class DocumentParseWorker {
    parserService;
    logger = new common_1.Logger(DocumentParseWorker_1.name);
    worker;
    constructor(parserService) {
        this.parserService = parserService;
    }
    onModuleInit() {
        this.worker = new bullmq_1.Worker(shared_1.QUEUES.DOCUMENT_PARSE, (job) => this.process(job), {
            connection: this.getRedisConnection(),
        });
        this.worker.on('failed', (job, error) => {
            this.logger.error(`Document parse job ${job?.id ?? 'unknown'} failed: ${error.message}`, error.stack);
        });
    }
    async onModuleDestroy() {
        await this.worker?.close();
    }
    async process(job) {
        try {
            return await this.parserService.parseDocument(job.data.documentId);
        }
        catch (error) {
            this.logger.error('Full parse error:', error);
            throw error;
        }
    }
    getRedisConnection() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            return {
                host: 'localhost',
                port: 6379,
            };
        }
        const parsedUrl = new URL(redisUrl);
        return {
            host: parsedUrl.hostname,
            port: Number(parsedUrl.port || 6379),
            username: parsedUrl.username || undefined,
            password: parsedUrl.password || undefined,
            tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
        };
    }
};
exports.DocumentParseWorker = DocumentParseWorker;
exports.DocumentParseWorker = DocumentParseWorker = DocumentParseWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [parser_service_js_1.ParserService])
], DocumentParseWorker);
//# sourceMappingURL=document-parse.worker.js.map