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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReloginViewerController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@uni-apply/shared");
const session_auth_guard_js_1 = require("../auth/session-auth.guard.js");
const queue_service_js_1 = require("../queue/queue.service.js");
const relogin_viewer_service_js_1 = require("./relogin-viewer.service.js");
const IN_FLIGHT_STATUSES = new Set(['active', 'waiting', 'delayed']);
let ReloginViewerController = class ReloginViewerController {
    reloginViewerService;
    queueService;
    constructor(reloginViewerService, queueService) {
        this.reloginViewerService = reloginViewerService;
        this.queueService = queueService;
    }
    async mintTicket(jobId) {
        if (!jobId?.trim()) {
            throw new common_1.BadRequestException('jobId is required.');
        }
        const job = await this.queueService.getJobDetails(shared_1.QUEUES.BROWSER_RELOGIN, jobId);
        if (!IN_FLIGHT_STATUSES.has(job.status)) {
            throw new common_1.BadRequestException(`Relogin job "${jobId}" is not currently running (status: ${job.status}).`);
        }
        const ticket = await this.reloginViewerService.mintTicket(jobId);
        return { ticket, expiresInMs: 60_000 };
    }
};
exports.ReloginViewerController = ReloginViewerController;
__decorate([
    (0, common_1.Post)('relogin-viewer-ticket'),
    __param(0, (0, common_1.Body)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReloginViewerController.prototype, "mintTicket", null);
exports.ReloginViewerController = ReloginViewerController = __decorate([
    (0, common_1.Controller)('universities'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __metadata("design:paramtypes", [relogin_viewer_service_js_1.ReloginViewerService,
        queue_service_js_1.QueueService])
], ReloginViewerController);
//# sourceMappingURL=relogin-viewer.controller.js.map