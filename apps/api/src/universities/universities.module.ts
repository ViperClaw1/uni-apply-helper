import { Module } from '@nestjs/common';
import { SchemasService } from './schemas.service.js';
import { UniversitiesController } from './universities.controller.js';
import { UniversitiesService } from './universities.service.js';

@Module({
  controllers: [UniversitiesController],
  providers: [UniversitiesService, SchemasService],
  exports: [UniversitiesService, SchemasService],
})
export class UniversitiesModule {}

