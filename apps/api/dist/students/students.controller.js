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
exports.StudentsController = void 0;
const common_1 = require("@nestjs/common");
const session_auth_guard_js_1 = require("../auth/session-auth.guard.js");
const students_service_1 = require("./students.service");
let StudentsController = class StudentsController {
    studentsService;
    constructor(studentsService) {
        this.studentsService = studentsService;
    }
    async getMyProfile(req) {
        const student = await this.studentsService.findByAccountId(req.account.id);
        return { student };
    }
    saveMyProfile(req, body) {
        return this.studentsService.upsertMyProfile(req.account.id, body);
    }
    saveMyEducation(req, body) {
        return this.studentsService.upsertMyEducation(req.account.id, body);
    }
    saveMyGuarantor(req, body) {
        return this.studentsService.upsertMyGuarantor(req.account.id, body);
    }
    saveMyEmergencyContact(req, body) {
        return this.studentsService.upsertMyEmergencyContact(req.account.id, body);
    }
    saveMyFamily(req, body) {
        return this.studentsService.upsertMyFamily(req.account.id, body);
    }
    findAll() {
        return this.studentsService.findAll();
    }
    create(body) {
        return this.studentsService.create(body);
    }
    findOne(id) {
        return this.studentsService.findOne(id);
    }
    remove(id) {
        return this.studentsService.remove(id);
    }
    getFullProfile(id) {
        return this.studentsService.getFullProfile(id);
    }
    updateProfile(id, body) {
        return this.studentsService.updateProfile(id, body);
    }
    updateEducation(id, body) {
        return this.studentsService.updateEducation(id, body);
    }
    updateGuarantor(id, body) {
        return this.studentsService.updateGuarantor(id, body);
    }
    updateEmergencyContact(id, body) {
        return this.studentsService.updateEmergencyContact(id, body);
    }
    updateFamily(id, body) {
        return this.studentsService.updateFamily(id, body);
    }
    setApplicationTargets(id, body) {
        return this.studentsService.setApplicationTargetsByFormUrls(id, body);
    }
    resolveApplicationTarget(id, body) {
        return this.studentsService.resolveApplicationTarget(id, body);
    }
};
exports.StudentsController = StudentsController;
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentsController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Put)('me'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "saveMyProfile", null);
__decorate([
    (0, common_1.Put)('me/education'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "saveMyEducation", null);
__decorate([
    (0, common_1.Put)('me/guarantor'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "saveMyGuarantor", null);
__decorate([
    (0, common_1.Put)('me/emergency-contact'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "saveMyEmergencyContact", null);
__decorate([
    (0, common_1.Put)('me/family'),
    (0, common_1.UseGuards)(session_auth_guard_js_1.SessionAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "saveMyFamily", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "getFullProfile", null);
__decorate([
    (0, common_1.Put)(':id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Put)(':id/education'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "updateEducation", null);
__decorate([
    (0, common_1.Put)(':id/guarantor'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "updateGuarantor", null);
__decorate([
    (0, common_1.Put)(':id/emergency-contact'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "updateEmergencyContact", null);
__decorate([
    (0, common_1.Put)(':id/family'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "updateFamily", null);
__decorate([
    (0, common_1.Put)(':id/application-targets'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "setApplicationTargets", null);
__decorate([
    (0, common_1.Post)(':id/application-targets/resolve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "resolveApplicationTarget", null);
exports.StudentsController = StudentsController = __decorate([
    (0, common_1.Controller)('students'),
    __metadata("design:paramtypes", [students_service_1.StudentsService])
], StudentsController);
//# sourceMappingURL=students.controller.js.map