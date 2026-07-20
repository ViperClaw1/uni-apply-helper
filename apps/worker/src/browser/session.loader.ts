import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { BrowserContextOptions } from 'playwright';

function getSessionsDir(): string {
  return resolve(process.cwd(), 'browser-sessions');
}

function getSessionEnvKey(universityId: string): string {
  return `${universityId.toUpperCase().replace(/-/g, '_')}_SESSION_STATE_B64`;
}

export function loadUniversityStorageState(
  configService: ConfigService,
  universityId: string,
): BrowserContextOptions['storageState'] | undefined {
  const envKey = getSessionEnvKey(universityId);
  const b64 = configService.get<string>(envKey);

  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  }

  const sessionFile = join(getSessionsDir(), `${universityId}.json`);

  if (existsSync(sessionFile)) {
    return JSON.parse(readFileSync(sessionFile, 'utf-8'));
  }

  if (universityId === 'shandong-university') {
    const legacyB64 = configService.get<string>('SDU_SESSION_STATE_B64');
    if (legacyB64) {
      return JSON.parse(Buffer.from(legacyB64, 'base64').toString('utf-8'));
    }

    const legacyFile = resolve(process.cwd(), 'sdu-session.json');
    if (existsSync(legacyFile)) {
      return JSON.parse(readFileSync(legacyFile, 'utf-8'));
    }
  }

  if (universityId === 'zhengzhou-university') {
    const legacyB64 = configService.get<string>('ZZU_SESSION_STATE_B64');
    if (legacyB64) {
      return JSON.parse(Buffer.from(legacyB64, 'base64').toString('utf-8'));
    }

    const legacyFile = resolve(process.cwd(), 'zzu-session.json');
    if (existsSync(legacyFile)) {
      return JSON.parse(readFileSync(legacyFile, 'utf-8'));
    }
  }

  return undefined;
}

export function getSessionEnvKeyForUniversity(universityId: string): string {
  return getSessionEnvKey(universityId);
}
