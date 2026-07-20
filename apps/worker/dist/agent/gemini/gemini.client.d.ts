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
    constructor(configService: ConfigService);
    isAvailable(): boolean;
    generateJson<T>(options: GenerateJsonOptions): Promise<T>;
}
export declare function parseJsonResponse<T>(raw: string): T;
export {};
