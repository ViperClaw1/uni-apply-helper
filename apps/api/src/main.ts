import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors({
    origin: process.env.DASHBOARD_ORIGIN?.split(',') ?? true,
    credentials: false,
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  // text() убран — он ломает multipart/form-data

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();