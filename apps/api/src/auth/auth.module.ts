import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MailService } from './mail.service.js';

@Module({
  controllers: [AuthController],
  providers: [ApiKeyGuard, AuthService, MailService],
  exports: [ApiKeyGuard],
})
export class AuthModule {}
