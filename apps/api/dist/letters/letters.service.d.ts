import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { StudentsService } from '../students/students.service.js';
import { UniversitiesService } from '../universities/universities.service.js';
import type { GenerateLetterInput, LetterResponse, UpdateLetterInput } from './types/letter-api.types.js';
export declare class LettersService {
    private readonly prisma;
    private readonly configService;
    private readonly studentsService;
    private readonly universitiesService;
    private readonly gemini?;
    private readonly model;
    constructor(prisma: PrismaService, configService: ConfigService, studentsService: StudentsService, universitiesService: UniversitiesService);
    generate(input: GenerateLetterInput): Promise<LetterResponse>;
    findByStudent(studentId: string): Promise<LetterResponse[]>;
    findByUniversity(universityId: string): Promise<LetterResponse[]>;
    findOne(id: string): Promise<LetterResponse>;
    update(id: string, input: UpdateLetterInput): Promise<LetterResponse>;
    approve(id: string): Promise<LetterResponse>;
    unapprove(id: string): Promise<LetterResponse>;
    remove(id: string): Promise<LetterResponse>;
    private generateWithGemini;
    private toGeminiUnavailableException;
    private buildPrompt;
    private assertGenerateInput;
    private toResponse;
}
