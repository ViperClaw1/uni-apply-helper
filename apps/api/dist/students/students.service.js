"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const universities_service_js_1 = require("../universities/universities.service.js");
let StudentsService = class StudentsService {
    prisma;
    universitiesService;
    constructor(prisma, universitiesService) {
        this.prisma = prisma;
        this.universitiesService = universitiesService;
    }
    async createFromNormalized(data) {
        const targets = this.parseTargets(data.applicationTargets, {
            major: data.applicationMajor,
            degree: data.applicationDegree,
            duration: data.applicationDuration,
            fundingSource: data.applicationFunding,
        });
        return this.prisma.student.create({
            data: {
                surname: data.personal?.surname ?? '',
                givenName: data.personal?.givenName ?? '',
                sex: data.personal?.sex,
                nationality: data.personal?.nationality,
                cityOfBirth: data.personal?.cityOfBirth,
                dateOfBirth: this.toDate(data.personal?.dateOfBirth),
                chineseName: data.personal?.chineseName,
                religion: data.personal?.religion,
                passportNo: data.personal?.passportNo,
                passportExpiry: this.toDate(data.personal?.passportExpiry),
                consulate: data.personal?.consulate,
                maritalStatus: data.personal?.maritalStatus,
                email: data.personal?.email ?? '',
                phone: data.personal?.phone,
                hobby: data.personal?.hobby,
                permanentAddress: data.personal?.permanentAddress,
                postCode: data.personal?.postCode,
                currentInstitution: data.personal?.currentInstitution,
                beenToChina: this.toBoolean(data.personal?.beenToChina),
                studiedInChina: this.toBoolean(data.personal?.studiedInChina),
                education: {
                    create: this.toArray(data.education)
                        .filter((education) => education?.degree && education?.institution)
                        .map((education) => ({
                        degree: education.degree,
                        institution: education.institution,
                        major: education.major,
                        periodStart: this.toDate(education.periodStart),
                        periodEnd: this.toDate(education.periodEnd),
                    })) ?? [],
                },
                languageSkills: {
                    create: [
                        data.languages?.chinese
                            ? {
                                language: 'chinese',
                                certificate: 'HSK',
                                score: String(data.languages.chinese),
                            }
                            : null,
                        data.languages?.english
                            ? {
                                language: 'english',
                                score: String(data.languages.english),
                            }
                            : null,
                    ].filter((languageSkill) => languageSkill !== null),
                },
                applicationTargets: {
                    create: targets,
                },
            },
        });
    }
    async getFullProfile(studentId) {
        const student = await this.prisma.student.findUniqueOrThrow({
            where: { id: studentId },
            include: {
                education: true,
                workExperience: true,
                languageSkills: true,
                familyMembers: true,
                guarantor: true,
                emergencyContact: true,
                documents: true,
                applicationTargets: true,
            },
        });
        const documents = student.documents.reduce((acc, document) => {
            acc[document.type] = document.fileUrl;
            return acc;
        }, {});
        return {
            id: student.id,
            personal: {
                surname: student.surname,
                givenName: student.givenName,
                sex: student.sex ?? undefined,
                nationality: student.nationality ?? undefined,
                cityOfBirth: student.cityOfBirth ?? undefined,
                dateOfBirth: student.dateOfBirth?.toISOString(),
                chineseName: student.chineseName ?? undefined,
                religion: student.religion ?? undefined,
                passportNo: student.passportNo ?? undefined,
                passportExpiry: student.passportExpiry?.toISOString(),
                consulate: student.consulate ?? undefined,
                maritalStatus: student.maritalStatus ?? undefined,
                email: student.email,
                phone: student.phone ?? undefined,
                hobby: student.hobby ?? undefined,
                permanentAddress: student.permanentAddress ?? undefined,
                postCode: student.postCode ?? undefined,
                currentInstitution: student.currentInstitution ?? undefined,
                beenToChina: student.beenToChina,
                studiedInChina: student.studiedInChina,
            },
            education: student.education.map((education) => ({
                degree: education.degree,
                institution: education.institution,
                major: education.major ?? undefined,
                periodStart: education.periodStart?.toISOString(),
                periodEnd: education.periodEnd?.toISOString(),
            })),
            workExperience: student.workExperience.map((workExperience) => ({
                company: workExperience.company,
                position: workExperience.position ?? undefined,
                periodStart: workExperience.periodStart?.toISOString(),
                periodEnd: workExperience.periodEnd?.toISOString(),
            })),
            languages: student.languageSkills.map((languageSkill) => ({
                language: languageSkill.language,
                certificate: languageSkill.certificate ?? undefined,
                score: languageSkill.score ?? undefined,
                level: languageSkill.level ?? undefined,
            })),
            familyMembers: student.familyMembers.map((familyMember) => ({
                fullName: familyMember.fullName,
                relationship: familyMember.relationship,
                nationality: familyMember.nationality ?? undefined,
                age: familyMember.age ?? undefined,
                company: familyMember.company ?? undefined,
                position: familyMember.position ?? undefined,
                phone: familyMember.phone ?? undefined,
                email: familyMember.email ?? undefined,
            })),
            guarantor: student.guarantor
                ? {
                    name: student.guarantor.name,
                    relationship: student.guarantor.relationship,
                    nationality: student.guarantor.nationality ?? undefined,
                    company: student.guarantor.company ?? undefined,
                    position: student.guarantor.position ?? undefined,
                    homeAddress: student.guarantor.homeAddress ?? undefined,
                    phone: student.guarantor.phone ?? undefined,
                    email: student.guarantor.email ?? undefined,
                }
                : undefined,
            emergencyContact: student.emergencyContact
                ? {
                    name: student.emergencyContact.name,
                    relationship: student.emergencyContact.relationship,
                    nationality: student.emergencyContact.nationality ?? undefined,
                    company: student.emergencyContact.company ?? undefined,
                    homeAddress: student.emergencyContact.homeAddress ?? undefined,
                    phone: student.emergencyContact.phone ?? undefined,
                    email: student.emergencyContact.email ?? undefined,
                }
                : undefined,
            documents,
            applicationTargets: student.applicationTargets.map((target) => ({
                universityRaw: target.universityRaw,
                universityId: target.universityId ?? undefined,
                degree: target.degree ?? undefined,
                major: target.major ?? undefined,
                duration: target.duration ?? undefined,
                fundingSource: target.fundingSource ?? undefined,
            })),
        };
    }
    async findAll() {
        return this.prisma.student.findMany({
            orderBy: { createdAt: 'desc' },
            include: { applicationTargets: true },
        });
    }
    async findOne(id) {
        return this.prisma.student.findUniqueOrThrow({ where: { id } });
    }
    async resolveApplicationTarget(studentId, input) {
        const universityRaw = input.universityRaw.trim();
        const universityId = input.universityId.trim();
        if (!universityRaw) {
            throw new common_1.BadRequestException('universityRaw is required.');
        }
        if (!universityId) {
            throw new common_1.BadRequestException('universityId is required.');
        }
        await this.findOne(studentId);
        await this.universitiesService.findOne(universityId);
        await this.universitiesService.createAlias({
            alias: universityRaw,
            universityId,
        });
        const result = await this.prisma.applicationTarget.updateMany({
            where: {
                studentId,
                universityRaw,
            },
            data: {
                universityId,
            },
        });
        if (result.count === 0) {
            throw new common_1.BadRequestException(`Application target "${universityRaw}" was not found for this student.`);
        }
        return this.getFullProfile(studentId);
    }
    parseTargets(raw, shared) {
        if (!raw) {
            return [];
        }
        const list = Array.isArray(raw) ? raw : [raw];
        return list
            .map((universityRaw) => universityRaw.trim())
            .filter(Boolean)
            .map((universityRaw) => ({ universityRaw, ...shared }));
    }
    toArray(value) {
        return Array.isArray(value) ? value : [];
    }
    toBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value !== 'string') {
            return false;
        }
        return ['yes', 'true', 'да'].includes(value.trim().toLowerCase());
    }
    toDate(value) {
        if (!value) {
            return null;
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime()) ? null : date;
    }
};
exports.StudentsService = StudentsService;
exports.StudentsService = StudentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        universities_service_js_1.UniversitiesService])
], StudentsService);
//# sourceMappingURL=students.service.js.map