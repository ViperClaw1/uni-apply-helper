import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';

const META_FILE = 'zzu-session-meta.json';

export type ZzuSessionMeta = {
  userAgent?: string;
  capturedAt?: string;
  mode?: 'storageState' | 'profile' | 'cdp';
};

export function loadZzuSessionMeta(
  configService: ConfigService,
): ZzuSessionMeta {
  const metaPath =
    configService.get<string>('ZZU_SESSION_META_PATH') ??
    resolve(process.cwd(), META_FILE);

  if (!existsSync(metaPath)) {
    return {};
  }

  return JSON.parse(readFileSync(metaPath, 'utf-8')) as ZzuSessionMeta;
}

export function getZzuContextOptions(meta: ZzuSessionMeta) {
  const options: {
    locale: string;
    timezoneId: string;
    userAgent?: string;
    extraHTTPHeaders: Record<string, string>;
  } = {
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  };

  if (meta.userAgent) {
    options.userAgent = meta.userAgent;
  }

  return options;
}
