"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTITUTION_MAX_LEN = void 0;
exports.shortenInstitutionName = shortenInstitutionName;
exports.INSTITUTION_MAX_LEN = 50;
function shortenInstitutionName(raw, max = exports.INSTITUTION_MAX_LEN) {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s) {
        return 'Higher Education Institution'.slice(0, max);
    }
    if (s.length <= max) {
        return s;
    }
    const schoolNo = s.match(/School\s*No\.?\s*\d+/i)?.[0]?.trim() ||
        s.match(/(?:№|No\.?)\s*\d+/i)?.[0]?.trim() ||
        s.match(/школа\s*(?:№|No\.?)?\s*\d+/i)?.[0]?.trim();
    const city = s.match(/City of\s+([A-Za-z\-]+)/i)?.[1];
    if (schoolNo) {
        const withCity = city && `${schoolNo}, ${city}`.length <= max
            ? `${schoolNo}, ${city}`
            : schoolNo;
        return withCity.slice(0, max).trim();
    }
    const commaParts = s
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    const last = commaParts[commaParts.length - 1];
    if (last && last.length <= max && last.length >= 8) {
        return last;
    }
    return s.slice(0, max).trim();
}
//# sourceMappingURL=text-limits.js.map