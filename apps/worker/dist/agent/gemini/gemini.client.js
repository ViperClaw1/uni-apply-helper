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
var GeminiClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
exports.parseJsonResponse = parseJsonResponse;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
let GeminiClient = GeminiClient_1 = class GeminiClient {
    configService;
    logger = new common_1.Logger(GeminiClient_1.name);
    gemini;
    model;
    constructor(configService) {
        this.configService = configService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (apiKey) {
            this.gemini = new genai_1.GoogleGenAI({ apiKey });
        }
        this.model =
            this.configService.get('GEMINI_AGENT_MODEL') ||
                this.configService.get('GEMINI_DOCUMENT_MODEL') ||
                'gemini-3.5-flash';
    }
    isAvailable() {
        return Boolean(this.gemini);
    }
    async generateJson(options) {
        if (!this.gemini) {
            throw new Error('GEMINI_API_KEY is not configured.');
        }
        const parts = [{ text: options.prompt }];
        if (options.screenshotBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: options.screenshotBase64,
                },
            });
        }
        const response = await this.gemini.models.generateContent({
            model: this.model,
            contents: [{ role: 'user', parts }],
            config: {
                temperature: options.temperature ?? 0.1,
                responseMimeType: 'application/json',
            },
        });
        const text = response.text?.trim();
        if (!text) {
            throw new Error('Gemini returned an empty response.');
        }
        return parseJsonResponse(text);
    }
};
exports.GeminiClient = GeminiClient;
exports.GeminiClient = GeminiClient = GeminiClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiClient);
function parseJsonResponse(raw) {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    try {
        return JSON.parse(fenced ?? trimmed);
    }
    catch (error) {
        throw new Error(`Failed to parse Gemini JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}
//# sourceMappingURL=gemini.client.js.map