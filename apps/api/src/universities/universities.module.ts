import { Module } from '@nestjs/common';
import { SchemaGeneratorService } from './schema-generator.service.js';
import { SchemasService } from './schemas.service.js';
import { UniversitiesController } from './universities.controller.js';
import { UniversitiesService } from './universities.service.js';

@Module({
  controllers: [UniversitiesController],
  providers: [UniversitiesService, SchemasService, SchemaGeneratorService],
  exports: [UniversitiesService, SchemasService, SchemaGeneratorService],
})
export class UniversitiesModule {}

