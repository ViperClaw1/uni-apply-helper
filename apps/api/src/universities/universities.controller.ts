import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SchemasService } from './schemas.service.js';
import { UniversitiesService } from './universities.service.js';

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

