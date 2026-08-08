import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, PublicAccount } from './auth.service.js';
import { SESSION_COOKIE_NAME, parseCookie } from './cookie.util.js';

export interface RequestWithAccount extends Request {
  account: PublicAccount;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAccount>();
    const sessionToken = parseCookie(
      request.headers.cookie,
      SESSION_COOKIE_NAME,
    );
    const account =
      await this.authService.getAccountBySessionToken(sessionToken);

    if (!account) {
      throw new UnauthorizedException('Not signed in.');
    }

    request.account = account;
    return true;
  }
}
