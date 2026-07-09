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
exports.LettersController = void 0;
const common_1 = require("@nestjs/common");
const letters_service_js_1 = require("./letters.service.js");
let LettersController = class LettersController {
    lettersService;
    constructor(lettersService) {
        this.lettersService = lettersService;
    }
    generate(body) {
        return this.lettersService.generate(body);
    }
    findByStudent(studentId) {
        return this.lettersService.findByStudent(studentId);
    }
    findByUniversity(universityId) {
        return this.lettersService.findByUniversity(universityId);
    }
    findOne(id) {
        return this.lettersService.findOne(id);
    }
    update(id, body) {
        return this.lettersService.update(id, body);
    }
    approve(id) {
        return this.lettersService.approve(id);
    }
    unapprove(id) {
        return this.lettersService.unapprove(id);
    }
    remove(id) {
        return this.lettersService.remove(id);
    }
};
exports.LettersController = LettersController;
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)('students/:studentId'),
    __param(0, (0, common_1.Param)('studentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "findByStudent", null);
__decorate([
    (0, common_1.Get)('universities/:universityId'),
    __param(0, (0, common_1.Param)('universityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "findByUniversity", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/unapprove'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "unapprove", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LettersController.prototype, "remove", null);
exports.LettersController = LettersController = __decorate([
    (0, common_1.Controller)('letters'),
    __metadata("design:paramtypes", [letters_service_js_1.LettersService])
], LettersController);
//# sourceMappingURL=letters.controller.js.map