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
var GeocodingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeocodingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GeocodingService = GeocodingService_1 = class GeocodingService {
    configService;
    logger = new common_1.Logger(GeocodingService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    isAvailable() {
        return Boolean(this.apiKey());
    }
    async resolve(address, hints) {
        const raw = address.trim();
        const fallback = this.heuristic(raw, hints);
        if (!raw) {
            return fallback;
        }
        const key = this.apiKey();
        if (!key) {
            return fallback;
        }
        try {
            const query = [raw, hints?.city, hints?.country].filter(Boolean).join(', ');
            const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            url.searchParams.set('address', query);
            url.searchParams.set('key', key);
            const res = await fetch(url.toString());
            if (!res.ok) {
                this.logger.warn(`Geocoding HTTP ${res.status}`);
                return fallback;
            }
            const data = (await res.json());
            if (data.status !== 'OK' || !data.results?.[0]) {
                this.logger.warn(`Geocoding status=${data.status}${data.error_message ? `: ${data.error_message}` : ''}`);
                return fallback;
            }
            const parsed = this.fromGoogle(data.results[0], fallback);
            this.logger.log(`Geocoded "${raw.slice(0, 60)}" → zip=${parsed.zip || '?'} city=${parsed.city || '?'}`);
            return parsed;
        }
        catch (error) {
            this.logger.warn(`Geocoding failed: ${error instanceof Error ? error.message : 'unknown'}`);
            return fallback;
        }
    }
    apiKey() {
        return (this.configService.get('GOOGLE_MAPS_API_KEY')?.trim() ||
            this.configService.get('GOOGLE_GEOCODING_API_KEY')?.trim() ||
            undefined);
    }
    fromGoogle(result, fallback) {
        const comps = result.address_components ?? [];
        const byType = (...types) => comps.find((c) => types.every((t) => c.types.includes(t)))?.long_name ||
            comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name ||
            '';
        const zip = byType('postal_code') || fallback.zip;
        const city = byType('locality') ||
            byType('postal_town') ||
            byType('administrative_area_level_2') ||
            byType('administrative_area_level_1') ||
            fallback.city;
        const country = byType('country') || fallback.country;
        const route = byType('route');
        const streetNumber = byType('street_number');
        const street = [streetNumber, route].filter(Boolean).join(' ').trim() ||
            fallback.streetAddress ||
            result.formatted_address ||
            fallback.formattedAddress;
        return {
            formattedAddress: result.formatted_address || fallback.formattedAddress || street,
            streetAddress: street,
            city,
            zip,
            country,
        };
    }
    heuristic(address, hints) {
        const zipMatch = address.match(/\b(\d{5,6})\b/) ||
            hints?.zip?.match(/\b(\d{5,6})\b/);
        const zip = zipMatch?.[1] || hints?.zip?.trim() || '000000';
        let city = hints?.city?.trim() || '';
        if (!city) {
            const beforeComma = address.split(',')[0]?.trim();
            if (beforeComma && beforeComma.length < 40 && !/^\d/.test(beforeComma)) {
                city = beforeComma;
            }
        }
        if (!city) {
            city = 'N/A';
        }
        return {
            formattedAddress: address || 'N/A',
            streetAddress: address || 'N/A',
            city,
            zip,
            country: hints?.country?.trim() || '',
        };
    }
};
exports.GeocodingService = GeocodingService;
exports.GeocodingService = GeocodingService = GeocodingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeocodingService);
//# sourceMappingURL=geocoding.service.js.map