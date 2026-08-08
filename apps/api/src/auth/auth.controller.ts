import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AccountRole } from '@uni-apply/database';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME, parseCookie } from './cookie.util';

const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  async signup(
    @Body()
    body: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      role?: AccountRole;
      agency?: { legalName?: string; country?: string; taxId?: string };
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const dashboardOrigin = (
      this.configService.get<string>('DASHBOARD_ORIGIN') ??
      'http://localhost:3001'
    )
      .split(',')[0]
      .replace(/\/$/, '');

    const result = await this.authService.signup(
      body,
      `${dashboardOrigin}/verify-email`,
    );

    if (result.token) {
      this.setSessionCookie(res, result.token);
      return { account: result.account };
    }

    return { email: result.email };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, account } = await this.authService.login(body);
    this.setSessionCookie(res, token);
    return { account };
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(
    @Body() body: { token?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, account } = await this.authService.verifyEmail(body.token);
    this.setSessionCookie(res, token);
    return { account };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionToken = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    await this.authService.logout(sessionToken);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const sessionToken = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    const account =
      await this.authService.getAccountBySessionToken(sessionToken);

    if (!account) {
      throw new UnauthorizedException('Not signed in.');
    }

    return { account };
  }

  private setSessionCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
  }
}
