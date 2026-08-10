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
      sex?: string;
      cityOfBirth?: string;
      chineseName?: string;
      religion?: string;
      passportExpiry?: string;
      consulate?: string;
      maritalStatus?: string;
      hobby?: string;
      permanentAddress?: string;
      postCode?: string;
      currentInstitution?: string;
      beenToChina?: boolean;
      studiedInChina?: boolean;
      desiredField?: string;
    },
  ) {
    return this.studentsService.upsertMyProfile(req.account.id, body);
  }

  @Put('me/education')
  @UseGuards(SessionAuthGuard)
  saveMyEducation(
    @Req() req: RequestWithAccount,
    @Body()
    body: {
      school?: {
        degree?: string;
        institution?: string;
        major?: string;
        periodStartYear?: number;
        periodEndYear?: number;
      };
      higher?: {
        degree?: string;
        institution?: string;
        major?: string;
        periodStartYear?: number;
        periodEndYear?: number;
      };
      chineseLevel?: string;
      englishLevel?: string;
    },
  ) {
    return this.studentsService.upsertMyEducation(req.account.id, body);
  }

  @Put('me/guarantor')
  @UseGuards(SessionAuthGuard)
  saveMyGuarantor(
    @Req() req: RequestWithAccount,
    @Body()
    body: {
      name?: string;
      relationship?: string;
      phone?: string;
      email?: string;
      homeAddress?: string;
    },
  ) {
    return this.studentsService.upsertMyGuarantor(req.account.id, body);
  }

  @Put('me/emergency-contact')
  @UseGuards(SessionAuthGuard)
  saveMyEmergencyContact(
    @Req() req: RequestWithAccount,
    @Body()
    body: {
      name?: string;
      relationship?: string;
      phone?: string;
      email?: string;
    },
  ) {
    return this.studentsService.upsertMyEmergencyContact(req.account.id, body);
  }

  @Put('me/family')
  @UseGuards(SessionAuthGuard)
  saveMyFamily(
    @Req() req: RequestWithAccount,
    @Body()
    body: {
      father?: {
        fullName?: string;
        nationality?: string;
        phone?: string;
        email?: string;
        company?: string;
        position?: string;
      };
      mother?: {
        fullName?: string;
        nationality?: string;
        phone?: string;
        email?: string;
        company?: string;
        position?: string;
      };
    },
  ) {
    return this.studentsService.upsertMyFamily(req.account.id, body);
  }

  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Post()
  create(
    @Body()
    body: {
      surname?: string;
      givenName?: string;
      email?: string;
      phone?: string;
    },
  ) {
    return this.studentsService.create(body);
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
