import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { StudentProfile, UniversitySchema } from '@uni-apply/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { StudentsService } from '../students/students.service.js';
import { UniversitiesService } from '../universities/universities.service.js';
import type {
  GenerateLetterInput,
  LetterResponse,
  LetterType,
  UpdateLetterInput,
} from './types/letter-api.types.js';

type GeneratedDocumentRecord = {
  id: string;
  studentId: string;
  universityId: string;
  type: string;
  content: string;
  approvedByConsultant: boolean;
  approvedAt: Date | null;
  generatedAt: Date;
};

@Injectable()
export class LettersService {
  private readonly anthropic?: Anthropic;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly studentsService: StudentsService,
    private readonly universitiesService: UniversitiesService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }

    this.model =
      this.configService.get<string>('ANTHROPIC_LETTER_MODEL') ??
      'claude-sonnet-4-5';
  }

  async generate(input: GenerateLetterInput): Promise<LetterResponse> {
    this.assertGenerateInput(input);

    const type = input.type ?? 'motivation_letter';
    const [profile, university] = await Promise.all([
      this.studentsService.getFullProfile(input.studentId),
      this.universitiesService.findOne(input.universityId),
    ]);

    const content = await this.generateWithClaude({
      profile,
      university,
      type,
      prompt: input.prompt,
    });

    const letter = await this.prisma.generatedDocument.create({
      data: {
        studentId: input.studentId,
        universityId: input.universityId,
        type,
        content,
      },
    });

    return this.toResponse(letter);
  }

  async findByStudent(studentId: string): Promise<LetterResponse[]> {
    await this.studentsService.findOne(studentId);

    const letters = await this.prisma.generatedDocument.findMany({
      where: { studentId },
      orderBy: { generatedAt: 'desc' },
    });

    return letters.map((letter) => this.toResponse(letter));
  }

  async findByUniversity(universityId: string): Promise<LetterResponse[]> {
    await this.universitiesService.findOne(universityId);

    const letters = await this.prisma.generatedDocument.findMany({
      where: { universityId },
      orderBy: { generatedAt: 'desc' },
    });

    return letters.map((letter) => this.toResponse(letter));
  }

  async findOne(id: string): Promise<LetterResponse> {
    const letter = await this.prisma.generatedDocument.findUnique({
      where: { id },
    });

    if (!letter) {
      throw new NotFoundException(`Letter "${id}" was not found.`);
    }

    return this.toResponse(letter);
  }

  async update(id: string, input: UpdateLetterInput): Promise<LetterResponse> {
    await this.findOne(id);

    if (input.content !== undefined && !input.content.trim()) {
      throw new BadRequestException('Letter content cannot be empty.');
    }

    const approvedByConsultant = input.approvedByConsultant;
    const letter = await this.prisma.generatedDocument.update({
      where: { id },
      data: {
        content: input.content?.trim(),
        approvedByConsultant,
        approvedAt:
          approvedByConsultant === undefined
            ? undefined
            : approvedByConsultant
              ? new Date()
              : null,
      },
    });

    return this.toResponse(letter);
  }

  async approve(id: string): Promise<LetterResponse> {
    return this.update(id, { approvedByConsultant: true });
  }

  async unapprove(id: string): Promise<LetterResponse> {
    return this.update(id, { approvedByConsultant: false });
  }

  async remove(id: string): Promise<LetterResponse> {
    await this.findOne(id);

    const letter = await this.prisma.generatedDocument.delete({
      where: { id },
    });

    return this.toResponse(letter);
  }

  private async generateWithClaude(input: {
    profile: StudentProfile;
    university: UniversitySchema;
    type: LetterType;
    prompt?: string;
  }): Promise<string> {
    if (!this.anthropic) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured.');
    }

    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: this.buildPrompt(input),
        },
      ],
    });

    return message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  }

  private buildPrompt(input: {
    profile: StudentProfile;
    university: UniversitySchema;
    type: LetterType;
    prompt?: string;
  }): string {
    const studentName = [
      input.profile.personal.givenName,
      input.profile.personal.surname,
    ]
      .filter(Boolean)
      .join(' ');
    const target = input.profile.applicationTargets.find(
      (item) => item.universityId === input.university.id,
    );
    const universityPrompt =
      input.prompt ?? input.university.essayPrompt ?? 'Write a strong motivation letter.';

    return [
      `Write a ${input.type.replace(/_/g, ' ')} for a university application.`,
      'Return only the final letter text. Do not include analysis, markdown fences, or metadata.',
      '',
      `Student: ${studentName}`,
      `Email: ${input.profile.personal.email}`,
      `Nationality: ${input.profile.personal.nationality ?? 'not provided'}`,
      `Current institution: ${
        input.profile.personal.currentInstitution ?? 'not provided'
      }`,
      `Education: ${JSON.stringify(input.profile.education)}`,
      `Languages: ${JSON.stringify(input.profile.languages)}`,
      `Application major: ${target?.major ?? 'not provided'}`,
      `Application degree: ${target?.degree ?? 'not provided'}`,
      `Funding source: ${target?.fundingSource ?? 'not provided'}`,
      '',
      `University: ${input.university.displayName}`,
      `University notes: ${input.university.notes ?? 'not provided'}`,
      `University prompt: ${universityPrompt}`,
      '',
      'Keep it specific, natural, and consultant-ready.',
    ].join('\n');
  }

  private assertGenerateInput(input: GenerateLetterInput): void {
    if (!input.studentId?.trim()) {
      throw new BadRequestException('studentId is required.');
    }

    if (!input.universityId?.trim()) {
      throw new BadRequestException('universityId is required.');
    }
  }

  private toResponse(letter: GeneratedDocumentRecord): LetterResponse {
    return {
      id: letter.id,
      studentId: letter.studentId,
      universityId: letter.universityId,
      type: letter.type,
      content: letter.content,
      approvedByConsultant: letter.approvedByConsultant,
      approvedAt: letter.approvedAt?.toISOString(),
      generatedAt: letter.generatedAt.toISOString(),
    };
  }
}

