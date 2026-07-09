import { LettersService } from './letters.service.js';
import type { GenerateLetterInput, UpdateLetterInput } from './types/letter-api.types.js';
export declare class LettersController {
    private readonly lettersService;
    constructor(lettersService: LettersService);
    generate(body: GenerateLetterInput): Promise<import("./types/letter-api.types.js").LetterResponse>;
    findByStudent(studentId: string): Promise<import("./types/letter-api.types.js").LetterResponse[]>;
    findByUniversity(universityId: string): Promise<import("./types/letter-api.types.js").LetterResponse[]>;
    findOne(id: string): Promise<import("./types/letter-api.types.js").LetterResponse>;
    update(id: string, body: UpdateLetterInput): Promise<import("./types/letter-api.types.js").LetterResponse>;
    approve(id: string): Promise<import("./types/letter-api.types.js").LetterResponse>;
    unapprove(id: string): Promise<import("./types/letter-api.types.js").LetterResponse>;
    remove(id: string): Promise<import("./types/letter-api.types.js").LetterResponse>;
}
