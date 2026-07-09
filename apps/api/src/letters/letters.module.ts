import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module.js';
import { UniversitiesModule } from '../universities/universities.module.js';
import { LettersController } from './letters.controller.js';
import { LettersService } from './letters.service.js';

@Module({
  imports: [StudentsModule, UniversitiesModule],
  controllers: [LettersController],
  providers: [LettersService],
  exports: [LettersService],
})
export class LettersModule {}

