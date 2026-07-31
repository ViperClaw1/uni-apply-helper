/**
 * 17gz free-text columns are often VARCHAR(50).
 * Full Russian legal school names blow Save and Next with "data field is too long".
 */
export const INSTITUTION_MAX_LEN = 50;

export function shortenInstitutionName(
  raw: string,
  max = INSTITUTION_MAX_LEN,
): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) {
    return 'Higher Education Institution'.slice(0, max);
  }
  if (s.length <= max) {
    return s;
  }

  const schoolNo =
    s.match(/School\s*No\.?\s*\d+/i)?.[0]?.trim() ||
    s.match(/(?:№|No\.?)\s*\d+/i)?.[0]?.trim() ||
    s.match(/школа\s*(?:№|No\.?)?\s*\d+/i)?.[0]?.trim();
  const city = s.match(/City of\s+([A-Za-z\-]+)/i)?.[1];
  if (schoolNo) {
    const withCity =
      city && `${schoolNo}, ${city}`.length <= max
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
