import { ConfigService } from '@nestjs/config';
import type { FormFillMode, UniversitySchema } from '@uni-apply/shared';

const FILL_MODES: FormFillMode[] = ['schema', 'agent', 'hybrid'];

export function resolveFillMode(
  configService: ConfigService,
  university: Pick<UniversitySchema, 'agent'>,
): FormFillMode {
  const envMode = configService.get<string>('FORM_FILL_MODE');

  if (envMode && FILL_MODES.includes(envMode as FormFillMode)) {
    return envMode as FormFillMode;
  }

  return university.agent?.fillMode ?? 'schema';
}

export function resolveMaxAgentSteps(
  configService: ConfigService,
  university: Pick<UniversitySchema, 'agent'>,
  fallback = 40,
): number {
  const envValue = Number(configService.get<string>('AGENT_MAX_STEPS'));

  if (Number.isFinite(envValue) && envValue > 0) {
    return envValue;
  }

  return university.agent?.maxSteps ?? fallback;
}

export function shouldUseVision(
  configService: ConfigService,
  university: Pick<UniversitySchema, 'agent'>,
): boolean {
  if (configService.get<string>('AGENT_USE_VISION') === '1') {
    return true;
  }

  return university.agent?.useVision ?? false;
}
