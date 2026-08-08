import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AccountRole } from '@uni-apply/database';
import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    constructor(authService: AuthService, configService: ConfigService);
    signup(body: {
        email?: string;
        password?: string;
        confirmPassword?: string;
        role?: AccountRole;
        agency?: {
            legalName?: string;
            country?: string;
            taxId?: string;
        };
    }): Promise<{
        email: string;
    }>;
    login(body: {
        email?: string;
        password?: string;
    }, res: Response): Promise<{
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
    verifyEmail(body: {
        token?: string;
    }, res: Response): Promise<{
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
    logout(req: Request, res: Response): Promise<{
        ok: boolean;
    }>;
    me(req: Request): Promise<{
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
    private setSessionCookie;
}
