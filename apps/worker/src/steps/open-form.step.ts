import { Injectable } from '@nestjs/common';
import { assertSessionValid } from '../browser/session.validator.js';
import { NavigationRegistry } from '../browser/navigation/navigation-registry.service.js';
import { AttentionRequiredError } from '../errors/attention-required.error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ApplicationPipelineStep,
  ApplicationStepContext,
} from './step-context.js';

type SessionCheckStatus = 'fresh' | 'expired' | 'attention_required';

@Injectable()
export class OpenFormStep implements ApplicationPipelineStep {
  readonly name = 'open_form';

  constructor(
    private readonly navigationRegistry: NavigationRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async execute(context: ApplicationStepContext): Promise<void> {
    const navigator = this.navigationRegistry.resolve(
      context.university.formUrl,
    );
    await navigator.navigate(context);

    try {
      await assertSessionValid(context.page, context.university);
    } catch (error) {
      await this.recordSessionCheck(
        context.university.id,
        error instanceof AttentionRequiredError
          ? 'attention_required'
          : 'expired',
      );
      throw error;
    }

    await this.recordSessionCheck(context.university.id, 'fresh');
  }

  private async recordSessionCheck(
    universityId: string,
    status: SessionCheckStatus,
  ): Promise<void> {
    const now = new Date();
    const valid = status === 'fresh';

    await this.prisma.browserSession.upsert({
      where: { universityId },
      create: {
        universityId,
        status,
        lastValidatedAt: now,
        validationMethod: 'job_pipeline',
        consecutiveFailures: valid ? 0 : 1,
      },
      update: {
        status,
        lastValidatedAt: now,
        validationMethod: 'job_pipeline',
        consecutiveFailures: valid ? 0 : { increment: 1 },
      },
    });
  }
}
