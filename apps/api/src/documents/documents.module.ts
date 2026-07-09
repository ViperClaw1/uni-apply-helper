import { Module } from '@nestjs/common';
import { DocumentParseWorker } from './document-parse.worker.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { ParserService } from './parser.service.js';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, ParserService, DocumentParseWorker],
  exports: [DocumentsService, ParserService],
})
export class DocumentsModule {}

