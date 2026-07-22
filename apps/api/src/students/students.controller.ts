import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
} from '@nestjs/common';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Get(':id/profile')
  getFullProfile(@Param('id') id: string) {
    return this.studentsService.getFullProfile(id);
  }

  @Put(':id/application-targets')
  setApplicationTargets(
    @Param('id') id: string,
    @Body() body: { formUrls?: string[] },
  ) {
    return this.studentsService.setApplicationTargetsByFormUrls(id, body);
  }

  @Post(':id/application-targets/resolve')
  resolveApplicationTarget(
    @Param('id') id: string,
    @Body() body: { universityRaw: string; universityId: string },
  ) {
    return this.studentsService.resolveApplicationTarget(id, body);
  }
}
