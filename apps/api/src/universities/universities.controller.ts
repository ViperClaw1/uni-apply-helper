import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SchemasService } from './schemas.service.js';
import { UniversitiesService } from './universities.service.js';
import type { CreateUniversityAliasInput } from './types/university-api.types.js';

@Controller('universities')
export class UniversitiesController {
  constructor(
    private readonly universitiesService: UniversitiesService,
    private readonly schemasService: SchemasService,
  ) {}

  @Get()
  findAll() {
    return this.universitiesService.findAll();
  }

  @Get('resolve')
  resolve(@Query('name') name?: string) {
    if (!name) {
      throw new BadRequestException('Query param "name" is required.');
    }

    return this.universitiesService.resolve(name);
  }

  @Post('aliases')
  createAlias(@Body() body: CreateUniversityAliasInput) {
    if (!body.alias?.trim()) {
      throw new BadRequestException('alias is required.');
    }

    if (!body.universityId?.trim()) {
      throw new BadRequestException('universityId is required.');
    }

    return this.universitiesService.createAlias(body);
  }

  @Post('schemas/seed')
  seedSchemas() {
    return this.schemasService.seedFromFiles();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.universitiesService.findOne(id);
  }

  @Get(':id/aliases')
  findAliases(@Param('id') id: string) {
    return this.universitiesService.findAliases(id);
  }
}

