import type { Page } from 'playwright';
import type { AttentionReason } from '../errors/attention-required.error.js';
export declare function detectAttentionRequired(page: Page, attentionIndicators?: string[]): Promise<AttentionReason | null>;
export declare function describeAttentionReason(reason: AttentionReason): string;
