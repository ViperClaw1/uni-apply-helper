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
exports.ScreenshotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const node_crypto_1 = require("node:crypto");
let ScreenshotService = class ScreenshotService {
    configService;
    s3;
    bucket;
    publicUrl;
    constructor(configService) {
        this.configService = configService;
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
    async capture(page, applicationId, label) {
        if (!this.s3 || !this.bucket || !this.publicUrl) {
            throw new common_1.ServiceUnavailableException('R2 storage is not configured.');
        }
        const body = await page.screenshot({ fullPage: true, type: 'png' });
        const key = [
            'applications',
            applicationId,
            'screenshots',
            `${label}-${(0, node_crypto_1.randomUUID)()}.png`,
        ].join('/');
        await this.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: 'image/png',
        }));
        return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
};
exports.ScreenshotService = ScreenshotService;
exports.ScreenshotService = ScreenshotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ScreenshotService);
//# sourceMappingURL=screenshot.service.js.map