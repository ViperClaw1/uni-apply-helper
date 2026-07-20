export declare class SessionExpiredError extends Error {
    readonly universityId?: string;
    constructor(message?: string, universityId?: string);
}
