import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithAccount } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // Declared before `:id` — Nest matches routes in registration order, and
  // `:id` would otherwise greedily match a literal "me" segment first.
  @Get('me')
  @UseGuards(SessionAuthGuard)
  async getMyProfile(@Req() req: RequestWithAccount) {
    // Wrapped, not returned bare: Express's default `res.send(null)` sends
    // a genuinely empty body (not even the string "null"), which breaks
    // `response.json()` on the client. An object is never special-cased.
    const student = await this.studentsService.findByAccountId(req.account.id);
    return { student };
  }

  @Put('me')
  @UseGuards(SessionAuthGuard)
  saveMyProfile(
    @Req() req: RequestWithAccount,
    @Body()
    body: {
      surname?: string;
      givenName?: string;
      email?: string;
      phone?: string;
      nationality?: string;
      dateOfBirth?: string;
      passportNo?: string;
    },
  ) {
    return this.studentsService.upsertMyProfile(req.account.id, body);
  }

  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
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
