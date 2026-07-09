import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module.js';
import { UniversitiesModule } from '../universities/universities.module.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  imports: [StudentsModule, UniversitiesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

