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
exports.UniversitiesController = void 0;
const common_1 = require("@nestjs/common");
const schemas_service_js_1 = require("./schemas.service.js");
const schema_generator_service_js_1 = require("./schema-generator.service.js");
const universities_service_js_1 = require("./universities.service.js");
let UniversitiesController = class UniversitiesController {
    universitiesService;
    schemasService;
    schemaGeneratorService;
    constructor(universitiesService, schemasService, schemaGeneratorService) {
        this.universitiesService = universitiesService;
        this.schemasService = schemasService;
        this.schemaGeneratorService = schemaGeneratorService;
    }
    findAll() {
        return this.universitiesService.findAll();
    }
    resolve(name) {
        if (!name) {
            throw new common_1.BadRequestException('Query param "name" is required.');
        }
        return this.universitiesService.resolve(name);
    }
    createAlias(body) {
        if (!body.alias?.trim()) {
            throw new common_1.BadRequestException('alias is required.');
        }
        if (!body.universityId?.trim()) {
            throw new common_1.BadRequestException('universityId is required.');
        }
        return this.universitiesService.createAlias(body);
    }
    seedSchemas() {
        return this.schemasService.seedFromFiles();
    }
    generateSchemaDraft(body) {
        return this.schemaGeneratorService.generateDraft(body);
    }
    findOne(id) {
        return this.universitiesService.findOne(id);
    }
    findAliases(id) {
        return this.universitiesService.findAliases(id);
    }
    relogin(id) {
        return this.universitiesService.requestRelogin(id);
    }
};
exports.UniversitiesController = UniversitiesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('resolve'),
    __param(0, (0, common_1.Query)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "resolve", null);
__decorate([
    (0, common_1.Post)('aliases'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "createAlias", null);
__decorate([
    (0, common_1.Post)('schemas/seed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "seedSchemas", null);
__decorate([
    (0, common_1.Post)('schemas/generate-draft'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "generateSchemaDraft", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/aliases'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "findAliases", null);
__decorate([
    (0, common_1.Patch)(':id/relogin'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "relogin", null);
exports.UniversitiesController = UniversitiesController = __decorate([
    (0, common_1.Controller)('universities'),
    __metadata("design:paramtypes", [universities_service_js_1.UniversitiesService,
        schemas_service_js_1.SchemasService,
        schema_generator_service_js_1.SchemaGeneratorService])
], UniversitiesController);
//# sourceMappingURL=universities.controller.js.map