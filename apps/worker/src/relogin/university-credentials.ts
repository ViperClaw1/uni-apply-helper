import { Logger } from '@nestjs/common';

const logger = new Logger('UniversityCredentials');

export type UniversityCredentials = {
  username: string;
  password: string;
};

let cache: Record<string, UniversityCredentials> | null = null;

/**
 * Optional per-university login credentials for auto-filling the relogin form, so a human only
 * has to solve the CAPTCHA rather than retype username/password every time. Sourced from a
 * single JSON env var (Railway secret) — never git, never the database.
 */
export function getUniversityCredentials(
  universityId: string,
): UniversityCredentials | undefined {
  if (cache === null) {
    cache = parseCredentials(process.env.UNIVERSITY_CREDENTIALS);
  }

  return cache[universityId];
}

function parseCredentials(
  raw: string | undefined,
): Record<string, UniversityCredentials> {
  if (!raw?.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('not an object');
    }

    return parsed as Record<string, UniversityCredentials>;
  } catch (error) {
    logger.warn(
      `UNIVERSITY_CREDENTIALS is set but isn't valid JSON — auto-fill disabled: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return {};
  }
}
