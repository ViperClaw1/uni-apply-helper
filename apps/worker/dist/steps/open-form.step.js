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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenFormStep = void 0;
const common_1 = require("@nestjs/common");
const session_validator_js_1 = require("../browser/session.validator.js");
const navigation_registry_service_js_1 = require("../browser/navigation/navigation-registry.service.js");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let OpenFormStep = class OpenFormStep {
    navigationRegistry;
    prisma;
    name = 'open_form';
    constructor(navigationRegistry, prisma) {
        this.navigationRegistry = navigationRegistry;
        this.prisma = prisma;
    }
    async execute(context) {
        const navigator = this.navigationRegistry.resolve(context.university.formUrl);
        await navigator.navigate(context);
        try {
            await (0, session_validator_js_1.assertSessionValid)(context.page, context.university);
        }
        catch (error) {
            await this.recordSessionCheck(context.university.id, false);
            throw error;
        }
        await this.recordSessionCheck(context.university.id, true);
    }
    async recordSessionCheck(universityId, valid) {
        const now = new Date();
        await this.prisma.browserSession.upsert({
            where: { universityId },
            create: {
                universityId,
                status: valid ? 'fresh' : 'expired',
                lastValidatedAt: now,
                validationMethod: 'job_pipeline',
                consecutiveFailures: valid ? 0 : 1,
            },
            update: {
                status: valid ? 'fresh' : 'expired',
                lastValidatedAt: now,
                validationMethod: 'job_pipeline',
                consecutiveFailures: valid ? 0 : { increment: 1 },
            },
        });
    }
};
exports.OpenFormStep = OpenFormStep;
exports.OpenFormStep = OpenFormStep = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [navigation_registry_service_js_1.NavigationRegistry,
        prisma_service_js_1.PrismaService])
], OpenFormStep);
//# sourceMappingURL=open-form.step.js.map