import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LettersService } from './letters.service.js';
import type {
  GenerateLetterInput,
  UpdateLetterInput,
} from './types/letter-api.types.js';

@Controller('letters')
export class LettersController {
  constructor(private readonly lettersService: LettersService) {}

  @Post('generate')
  generate(@Body() body: GenerateLetterInput) {
    return this.lettersService.generate(body);
  }

  @Get('students/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.lettersService.findByStudent(studentId);
  }

  @Get('universities/:universityId')
  findByUniversity(@Param('universityId') universityId: string) {
    return this.lettersService.findByUniversity(universityId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lettersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLetterInput) {
    return this.lettersService.update(id, body);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.lettersService.approve(id);
  }

  @Post(':id/unapprove')
  unapprove(@Param('id') id: string) {
    return this.lettersService.unapprove(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lettersService.remove(id);
  }
}

