import { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, PublicAccount } from './auth.service.js';
export interface RequestWithAccount extends Request {
    account: PublicAccount;
}
export declare class SessionAuthGuard implements CanActivate {
    private readonly authService;
    constructor(authService: AuthService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
