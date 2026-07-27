import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GeocodeParts = {
  formattedAddress: string;
  streetAddress: string;
  city: string;
  zip: string;
  country: string;
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
};

type GoogleGeocodeResponse = {
  status: string;
  results?: GoogleGeocodeResult[];
  error_message?: string;
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly configService: ConfigService) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey());
  }

  /**
   * Resolve structured address parts from a free-form profile address.
   * Prefer Google Geocoding when GOOGLE_MAPS_API_KEY / GOOGLE_GEOCODING_API_KEY is set;
   * otherwise heuristic parse (zip / city guesses).
   */
  async resolve(
    address: string,
    hints?: { city?: string; zip?: string; country?: string },
  ): Promise<GeocodeParts> {
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

      const data = (await res.json()) as GoogleGeocodeResponse;
      if (data.status !== 'OK' || !data.results?.[0]) {
        this.logger.warn(
          `Geocoding status=${data.status}${data.error_message ? `: ${data.error_message}` : ''}`,
        );
        return fallback;
      }

      const parsed = this.fromGoogle(data.results[0], fallback);
      this.logger.log(
        `Geocoded "${raw.slice(0, 60)}" → zip=${parsed.zip || '?'} city=${parsed.city || '?'}`,
      );
      return parsed;
    } catch (error) {
      this.logger.warn(
        `Geocoding failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return fallback;
    }
  }

  private apiKey(): string | undefined {
    return (
      this.configService.get<string>('GOOGLE_MAPS_API_KEY')?.trim() ||
      this.configService.get<string>('GOOGLE_GEOCODING_API_KEY')?.trim() ||
      undefined
    );
  }

  private fromGoogle(
    result: GoogleGeocodeResult,
    fallback: GeocodeParts,
  ): GeocodeParts {
    const comps = result.address_components ?? [];
    const byType = (...types: string[]) =>
      comps.find((c) => types.every((t) => c.types.includes(t)))?.long_name ||
      comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name ||
      '';

    const zip = byType('postal_code') || fallback.zip;
    const city =
      byType('locality') ||
      byType('postal_town') ||
      byType('administrative_area_level_2') ||
      byType('administrative_area_level_1') ||
      fallback.city;
    const country = byType('country') || fallback.country;
    const route = byType('route');
    const streetNumber = byType('street_number');
    const street =
      [streetNumber, route].filter(Boolean).join(' ').trim() ||
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

  private heuristic(
    address: string,
    hints?: { city?: string; zip?: string; country?: string },
  ): GeocodeParts {
    const zipMatch =
      address.match(/\b(\d{5,6})\b/) ||
      hints?.zip?.match(/\b(\d{5,6})\b/);
    const zip = zipMatch?.[1] || hints?.zip?.trim() || '000000';

    // "City, street…" or trailing city token
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
}
