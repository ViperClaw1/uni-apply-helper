import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard.js';
import { ApplicationsService } from './applications.service.js';
import type {
  CreateApplicationBatchInput,
  SubmitApplicationInput,
  UpdateApplicationInput,
} from './types/application-api.types.js';

@Controller()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('applications/batches')
  createBatch(@Body() body: CreateApplicationBatchInput) {
    return this.applicationsService.createBatch(body);
  }

  @Post('students/:studentId/applications/batches')
  createBatchForStudent(@Param('studentId') studentId: string) {
    return this.applicationsService.createBatch({ studentId });
  }

  @Get('students/:studentId/applications/batches')
  findByStudent(@Param('studentId') studentId: string) {
    return this.applicationsService.findByStudent(studentId);
  }

  @Get('applications/batches/:id')
  findBatch(@Param('id') id: string) {
    return this.applicationsService.findBatch(id);
  }

  @Get('applications/active')
  @UseGuards(ApiKeyGuard)
  findActive(
    @Query('url') url: string,
    @Query('studentId') studentId: string,
  ) {
    return this.applicationsService.findActiveByUrl(url, studentId);
  }

  @Get('applications/:id')
  findApplication(@Param('id') id: string) {
    return this.applicationsService.findApplication(id);
  }

  @Patch('applications/:id/ready')
  markApplicationReady(@Param('id') id: string) {
    return this.applicationsService.markApplicationReady(id);
  }

  @Post('applications/:id/submit')
  @UseGuards(ApiKeyGuard)
  submitApplication(
    @Param('id') id: string,
    @Body() body: SubmitApplicationInput,
  ) {
    return this.applicationsService.submitApplication(id, body);
  }

  @Patch('applications/:id')
  updateApplication(
    @Param('id') id: string,
    @Body() body: UpdateApplicationInput,
  ) {
    return this.applicationsService.updateApplication(id, body);
  }

  @Post('applications/:id/steps')
  addStep(
    @Param('id') id: string,
    @Body()
    body: {
      stepName: string;
      status: string;
      errorMessage?: string;
    },
  ) {
    return this.applicationsService.addStep(id, body);
  }
}
