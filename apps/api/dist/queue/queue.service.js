"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
let QueueService = class QueueService {
    queues = new Map();
    async onModuleDestroy() {
        await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    }
    async addJob(queueName, data, opts = {}) {
        return this.getQueue(queueName).add(queueName, data, {
            attempts: 2,
            backoff: { type: 'fixed', delay: 30_000 },
            ...opts,
        });
    }
    async getJobStatus(queueName, jobId) {
        const job = await this.getQueue(queueName).getJob(jobId);
        return job?.getState();
    }
    getQueue(name) {
        const existingQueue = this.queues.get(name);
        if (existingQueue) {
            return existingQueue;
        }
        const queue = new bullmq_1.Queue(name, {
            connection: this.getRedisConnection(),
        });
        this.queues.set(name, queue);
        return queue;
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
exports.QueueService = QueueService;
exports.QueueService = QueueService = __decorate([
    (0, common_1.Injectable)()
], QueueService);
//# sourceMappingURL=queue.service.js.map