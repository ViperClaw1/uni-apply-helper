import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';

function getUniversityProfileEnvKey(universityId: string): string {
  return `BROWSER_PROFILE_DIR_${universityId.toUpperCase().replace(/-/g, '_')}`;
}

export function resolveProfileDir(
  configService: ConfigService,
  universityId: string,
): string | undefined {
  const overrideDir = configService.get<string>(
    getUniversityProfileEnvKey(universityId),
  );
  if (overrideDir) {
    return overrideDir;
  }

  const profilesRoot = configService.get<string>('BROWSER_PROFILES_DIR');
  if (profilesRoot) {
    return join(profilesRoot, universityId);
  }

  if (universityId === 'shandong-university') {
    const sduProfileDir = configService.get<string>('SDU_PROFILE_DIR');
    const useSduProfile =
      configService.get<string>('SDU_USE_PROFILE') === '1' || Boolean(sduProfileDir);

    if (useSduProfile) {
      return sduProfileDir ?? join(process.cwd(), 'profiles', 'shandong-university');
    }
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
