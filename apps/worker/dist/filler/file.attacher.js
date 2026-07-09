"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAttacher = void 0;
const common_1 = require("@nestjs/common");
let FileAttacher = class FileAttacher {
    async attachFiles(page, profile, fields) {
        const fileFields = fields.filter((field) => field.type === 'file' && field.documentType);
        for (const field of fileFields) {
            const fileUrl = profile.documents[field.documentType];
            if (!fileUrl) {
                if (field.required) {
                    throw new Error(`Missing required document: ${field.documentType}`);
                }
                continue;
            }
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to download document ${field.documentType}`);
            }
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            const buffer = Buffer.from(await response.arrayBuffer());
            await page.locator(field.selector).setInputFiles({
                name: `${field.documentType}.pdf`,
                mimeType: contentType,
                buffer,
            });
        }
    }
};
exports.FileAttacher = FileAttacher;
exports.FileAttacher = FileAttacher = __decorate([
    (0, common_1.Injectable)()
], FileAttacher);
//# sourceMappingURL=file.attacher.js.map