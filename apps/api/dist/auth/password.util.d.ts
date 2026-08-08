export declare const PASSWORD_POLICY_REGEX: RegExp;
export declare const PASSWORD_POLICY_MESSAGE = "Password must be at least 8 characters and include at least one letter and one digit.";
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string): boolean;
export declare const DUMMY_PASSWORD_HASH: string;
