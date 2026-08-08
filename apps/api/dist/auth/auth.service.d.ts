import { AccountRole } from '@uni-apply/database';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
type AgencyInput = {
    legalName?: string;
    country?: string;
    taxId?: string;
};
type SignupInput = {
    email?: string;
    password?: string;
    confirmPassword?: string;
    role?: AccountRole;
    agency?: AgencyInput;
};
type LoginInput = {
    email?: string;
    password?: string;
};
export type PublicAccount = {
    id: string;
    email: string;
    role: AccountRole;
    emailVerifiedAt: Date | null;
    agencyProfile?: {
        legalName: string;
        country: string;
        taxId: string;
    };
};
export declare class AuthService {
    private readonly prisma;
    private readonly mailService;
    private readonly logger;
    constructor(prisma: PrismaService, mailService: MailService);
    signup(input: SignupInput, verifyBaseUrl: string): Promise<{
        email: string;
        token: string;
        account: PublicAccount;
    } | {
        email: string;
        token: undefined;
        account: undefined;
    }>;
    login(input: LoginInput): Promise<{
        token: string;
        account: PublicAccount;
    }>;
    verifyEmail(token: string | undefined): Promise<{
        token: string;
        account: PublicAccount;
    }>;
    logout(sessionToken: string | undefined): Promise<void>;
    getAccountBySessionToken(sessionToken: string | undefined): Promise<PublicAccount | null>;
    private createAccount;
    private createSession;
    private validateAgencyInput;
    private toPublicAccount;
}
export {};
