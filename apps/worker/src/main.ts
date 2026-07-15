import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { assertWorkerRuntime } from './assert-railway-service.js';

async function bootstrap() {
  assertWorkerRuntime();

  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  await app.init();
  logger.log('apps/worker started — BullMQ consumer for application.process');
}

bootstrap();
