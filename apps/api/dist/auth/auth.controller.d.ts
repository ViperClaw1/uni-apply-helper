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
    }, res: Response): Promise<{
        account: import("./auth.service").PublicAccount;
        email?: undefined;
    } | {
        email: string;
        account?: undefined;
    }>;
    login(body: {
        email?: string;
        password?: string;
    }, res: Response): Promise<{
        account: import("./auth.service").PublicAccount;
    }>;
    verifyEmail(body: {
        token?: string;
    }, res: Response): Promise<{
        account: import("./auth.service").PublicAccount;
    }>;
    logout(req: Request, res: Response): Promise<{
        ok: boolean;
    }>;
    me(req: Request): Promise<{
        account: import("./auth.service").PublicAccount;
    }>;
    private setSessionCookie;
}
