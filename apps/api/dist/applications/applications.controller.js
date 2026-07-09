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
exports.ApplicationsController = void 0;
const common_1 = require("@nestjs/common");
const applications_service_js_1 = require("./applications.service.js");
let ApplicationsController = class ApplicationsController {
    applicationsService;
    constructor(applicationsService) {
        this.applicationsService = applicationsService;
    }
    createBatch(body) {
        return this.applicationsService.createBatch(body);
    }
    createBatchForStudent(studentId) {
        return this.applicationsService.createBatch({ studentId });
    }
    findByStudent(studentId) {
        return this.applicationsService.findByStudent(studentId);
    }
    findBatch(id) {
        return this.applicationsService.findBatch(id);
    }
    findApplication(id) {
        return this.applicationsService.findApplication(id);
    }
    updateApplication(id, body) {
        return this.applicationsService.updateApplication(id, body);
    }
    addStep(id, body) {
        return this.applicationsService.addStep(id, body);
    }
};
exports.ApplicationsController = ApplicationsController;
__decorate([
    (0, common_1.Post)('applications/batches'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "createBatch", null);
__decorate([
    (0, common_1.Post)('students/:studentId/applications/batches'),
    __param(0, (0, common_1.Param)('studentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "createBatchForStudent", null);
__decorate([
    (0, common_1.Get)('students/:studentId/applications/batches'),
    __param(0, (0, common_1.Param)('studentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findByStudent", null);
__decorate([
    (0, common_1.Get)('applications/batches/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findBatch", null);
__decorate([
    (0, common_1.Get)('applications/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findApplication", null);
__decorate([
    (0, common_1.Patch)('applications/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "updateApplication", null);
__decorate([
    (0, common_1.Post)('applications/:id/steps'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "addStep", null);
exports.ApplicationsController = ApplicationsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [applications_service_js_1.ApplicationsService])
], ApplicationsController);
//# sourceMappingURL=applications.controller.js.map