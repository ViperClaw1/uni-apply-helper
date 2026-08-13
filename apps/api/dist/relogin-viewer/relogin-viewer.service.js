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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReloginViewerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReloginViewerService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_net_1 = require("node:net");
const redis_client_provider_js_1 = require("./redis-client.provider.js");
const TICKET_PREFIX = 'relogin-viewer:';
const TICKET_TTL_MS = 60_000;
let ReloginViewerService = ReloginViewerService_1 = class ReloginViewerService {
    redis;
    logger = new common_1.Logger(ReloginViewerService_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    async onModuleDestroy() {
        await this.redis.quit();
    }
    async mintTicket(jobId) {
        const ticket = (0, node_crypto_1.randomBytes)(32).toString('hex');
        await this.redis.set(`${TICKET_PREFIX}${ticket}`, jobId, 'PX', TICKET_TTL_MS, 'NX');
        return ticket;
    }
    async consumeTicket(ticket) {
        return this.redis.getdel(`${TICKET_PREFIX}${ticket}`);
    }
    proxy(ws, jobId) {
        const host = process.env.WORKER_VNC_HOST;
        const port = Number(process.env.WORKER_VNC_PORT ?? 5900);
        if (!host) {
            this.logger.error('WORKER_VNC_HOST is not configured.');
            ws.close(1011, 'Viewer is not configured.');
            return;
        }
        const socket = (0, node_net_1.connect)({ host, port });
        const cleanup = () => {
            socket.destroy();
            if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
                ws.close();
            }
        };
        socket.on('connect', () => {
            this.logger.log(`Relogin viewer connected for job ${jobId} → ${host}:${port}`);
        });
        socket.on('data', (chunk) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(chunk);
            }
        });
        socket.on('error', (error) => {
            this.logger.warn(`VNC socket error for job ${jobId}: ${error.message}`);
            cleanup();
        });
        socket.on('close', cleanup);
        ws.on('message', (data) => {
            if (Array.isArray(data)) {
                socket.write(Buffer.concat(data));
            }
            else if (Buffer.isBuffer(data)) {
                socket.write(data);
            }
            else {
                socket.write(Buffer.from(data));
            }
        });
        ws.on('close', () => socket.destroy());
        ws.on('error', () => socket.destroy());
    }
};
exports.ReloginViewerService = ReloginViewerService;
exports.ReloginViewerService = ReloginViewerService = ReloginViewerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_client_provider_js_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], ReloginViewerService);
//# sourceMappingURL=relogin-viewer.service.js.map