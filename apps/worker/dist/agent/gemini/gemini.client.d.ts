import { ConfigService } from '@nestjs/config';
type GenerateJsonOptions = {
    prompt: string;
    screenshotBase64?: string;
    temperature?: number;
};
export declare class GeminiClient {
    private readonly configService;
    private readonly logger;
    private readonly gemini?;
    private readonly model;
    private readonly thinkingLevel;
    private resolvedModel?;
    constructor(configService: ConfigService);
    isAvailable(): boolean;
    generateJson<T>(options: GenerateJsonOptions): Promise<T>;
    private generateContentWithFallback;
    private getModelCandidates;
    private isGeminiModelNotFoundError;
    private isGeminiQuotaError;
    private getRetryDelayMs;
    private delay;
}
export declare function parseJsonResponse<T>(raw: string): T;
export {};
