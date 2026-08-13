import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { redisClientProvider } from './redis-client.provider.js';
import { ReloginViewerController } from './relogin-viewer.controller.js';
import { ReloginViewerService } from './relogin-viewer.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReloginViewerController],
  providers: [redisClientProvider, ReloginViewerService],
  exports: [ReloginViewerService],
})
export class ReloginViewerModule {}
