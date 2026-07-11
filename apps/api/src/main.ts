import { NestFactory } from '@nestjs/core';
import { json, text, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(text({ type: '*/*', limit: '1mb' }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
