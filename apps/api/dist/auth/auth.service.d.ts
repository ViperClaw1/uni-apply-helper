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
export declare class AuthService {
    private readonly prisma;
    private readonly mailService;
    constructor(prisma: PrismaService, mailService: MailService);
    signup(input: SignupInput, verifyBaseUrl: string): Promise<{
        email: string;
    }>;
    login(input: LoginInput): Promise<{
        token: string;
        account: {
            id: string;
            email: string;
            role: import("@uni-apply/database/dist/generated/prisma/client").$Enums.AccountRole;
            emailVerifiedAt: Date | null;
            agencyProfile: {
                legalName: string;
                country: string;
                taxId: string;
            } | undefined;
        };
    }>;
    verifyEmail(token: string | undefined): Promise<{
        token: string;
        account: {
            id: string;
            email: string;
            role: import("@uni-apply/database/dist/generated/prisma/client").$Enums.AccountRole;
            emailVerifiedAt: Date | null;
            agencyProfile: {
                legalName: string;
                country: string;
                taxId: string;
            } | undefined;
        };
    }>;
    logout(sessionToken: string | undefined): Promise<void>;
    getAccountBySessionToken(sessionToken: string | undefined): Promise<{
        id: string;
        email: string;
        role: import("@uni-apply/database/dist/generated/prisma/client").$Enums.AccountRole;
        emailVerifiedAt: Date | null;
        agencyProfile: {
            legalName: string;
            country: string;
            taxId: string;
        } | undefined;
    } | null>;
    private createSession;
    private validateAgencyInput;
    private toPublicAccount;
}
export {};
