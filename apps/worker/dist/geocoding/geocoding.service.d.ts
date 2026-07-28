import { ConfigService } from '@nestjs/config';
export type GeocodeParts = {
    formattedAddress: string;
    streetAddress: string;
    city: string;
    zip: string;
    country: string;
};
export declare class GeocodingService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    isAvailable(): boolean;
    resolve(address: string, hints?: {
        city?: string;
        zip?: string;
        country?: string;
    }): Promise<GeocodeParts>;
    private apiKey;
    private fromGoogle;
    private heuristic;
}
