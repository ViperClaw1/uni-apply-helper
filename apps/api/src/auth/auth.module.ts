import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MailService } from './mail.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [ApiKeyGuard, AuthService, MailService, SessionAuthGuard],
  exports: [ApiKeyGuard, SessionAuthGuard, AuthService],
})
export class AuthModule {}
