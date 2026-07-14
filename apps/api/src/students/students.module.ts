import { Module } from '@nestjs/common';
import { UniversitiesModule } from '../universities/universities.module.js';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [UniversitiesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
