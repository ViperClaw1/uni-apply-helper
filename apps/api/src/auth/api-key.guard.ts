import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    const expected = this.configService.get<string>('EXTENSION_API_KEY');

    if (!expected) {
      throw new UnauthorizedException('Extension API key auth is not configured.');
    }

    if (typeof apiKey !== 'string' || apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key.');
    }

    return true;
  }
}
