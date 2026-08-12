export type AttentionReason = 'captcha' | 'two_factor' | 'text_indicator';
export declare class AttentionRequiredError extends Error {
    readonly universityId?: string;
    readonly reason: AttentionReason;
    constructor(message: string, reason: AttentionReason, universityId?: string);
}
