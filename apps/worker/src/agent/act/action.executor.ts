import { Injectable } from '@nestjs/common';
import type { AgentAction, AgentActionTarget } from '@uni-apply/shared';
import type { Locator, Page } from 'playwright';

@Injectable()
export class ActionExecutor {
  async execute(page: Page, action: AgentAction): Promise<void> {
    switch (action.type) {
      case 'fill':
        await this.resolveLocator(page, action.target).fill(action.value ?? '');
        return;
      case 'select':
        await this.resolveLocator(page, action.target)
          .selectOption({ label: action.value ?? '' })
          .catch(async () => {
            await this.resolveLocator(page, action.target).selectOption(
              action.value ?? '',
            );
          });
        return;
      case 'check':
        await this.resolveLocator(page, action.target).check();
        return;
      case 'click':
        await this.resolveLocator(page, action.target).click({ force: true });
        return;
      case 'upload':
        throw new Error('upload action is not implemented in scaffold yet');
      case 'wait':
        await page.waitForTimeout(Number(action.value ?? 1_000));
        return;
      case 'done':
      case 'fail':
        return;
      default:
        throw new Error(`Unsupported agent action: ${action.type}`);
    }
  }

  resolveLocator(page: Page, target?: AgentActionTarget): Locator {
    if (!target) {
      throw new Error('Agent action target is required.');
    }

    if (target.selector) {
      return page.locator(target.selector).first();
    }

    if (target.label) {
      return page.getByLabel(target.label, { exact: false }).first();
    }

    if (target.placeholder) {
      return page.getByPlaceholder(target.placeholder, { exact: false }).first();
    }

    if (target.role && target.name) {
      return page
        .getByRole(target.role as Parameters<Page['getByRole']>[0], {
          name: target.name,
          exact: false,
        })
        .first();
    }

    if (target.name) {
      return page.getByText(target.name, { exact: false }).first();
    }

    throw new Error('Could not resolve locator from agent target.');
  }
}
