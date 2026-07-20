import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';

export function resolveProfileDir(
  configService: ConfigService,
  universityId: string,
): string | undefined {
  const profilesRoot = configService.get<string>('BROWSER_PROFILES_DIR');

  if (profilesRoot) {
    return join(profilesRoot, universityId);
  }

  const legacyProfileDir = configService.get<string>('ZZU_PROFILE_DIR');
  const useLegacyProfile =
    configService.get<string>('ZZU_USE_PROFILE') === '1' || Boolean(legacyProfileDir);

  if (useLegacyProfile && universityId === 'zhengzhou-university') {
    return legacyProfileDir ?? join(process.cwd(), 'zzu-browser-profile');
  }

  return undefined;
}

export function getProfilesRoot(configService: ConfigService): string {
  return (
    configService.get<string>('BROWSER_PROFILES_DIR') ??
    join(process.cwd(), 'profiles')
  );
}
