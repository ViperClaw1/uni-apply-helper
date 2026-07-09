import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service.js';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
} from './types/document-api.types.js';

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('students/:studentId/documents')
  findByStudent(@Param('studentId') studentId: string) {
    return this.documentsService.findByStudent(studentId);
  }

  @Post('students/:studentId/documents')
  create(
    @Param('studentId') studentId: string,
    @Body() body: CreateDocumentInput,
  ) {
    return this.documentsService.create(studentId, body);
  }

  @Post('students/:studentId/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('studentId') studentId: string,
    @Body('type') type: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.documentsService.upload(studentId, type, file);
  }

  @Get('documents/:id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch('documents/:id')
  update(@Param('id') id: string, @Body() body: UpdateDocumentInput) {
    return this.documentsService.update(id, body);
  }

  @Delete('documents/:id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}

