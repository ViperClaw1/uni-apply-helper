import { BadRequestException, Injectable } from '@nestjs/common';
import { StudentProfile, groupDocumentUrls } from '@uni-apply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UniversitiesService } from '../universities/universities.service.js';

type ApplicationTargetInput = {
  universityRaw: string;
  universityId?: string;
  degree?: string;
  major?: string;
  duration?: string;
  fundingSource?: string;
};

type EducationInput = {
  level?: string;
  degree?: string;
  institution?: string;
  major?: string;
  periodStart?: unknown;
  periodEnd?: unknown;
};

type ContactInput = {
  name?: string;
  relationship?: string;
  nationality?: string;
  company?: string;
  position?: string;
  homeAddress?: string;
  phone?: string;
  email?: string;
};

type FamilyMemberInput = {
  fullName?: string;
  relationship?: string;
  nationality?: string;
  company?: string;
  position?: string;
  phone?: string;
  email?: string;
};

type FamilyRelativeInput = {
  fullName?: string;
  nationality?: string;
  company?: string;
  position?: string;
  phone?: string;
  email?: string;
};

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly universitiesService: UniversitiesService,
  ) {}

  async createFromNormalized(data: Record<string, any>) {
    const targets = this.parseTargets(data.applicationTargets, {
      major: data.applicationMajor,
      degree: data.applicationDegree,
      duration: data.applicationDuration,
      fundingSource: data.applicationFunding,
    });
    const familyMembers = this.parseFamilyMembers(data);

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
        desiredField: data.personal?.desiredField
          ? String(data.personal.desiredField).trim() || null
          : null,
        education: {
          create: this.buildEducationCreates(data.education),
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
        familyMembers: {
          create: familyMembers,
        },
        applicationTargets: {
          create: targets,
        },
        ...(this.hasContactData(data.guarantor)
          ? {
              guarantor: {
                create: this.toContactCreateData(data.guarantor),
              },
            }
          : {}),
        ...(this.hasContactData(data.emergencyContact)
          ? {
              emergencyContact: {
                create: this.toContactCreateData(data.emergencyContact),
              },
            }
          : {}),
      },
    });
  }

  async getFullProfile(studentId: string): Promise<StudentProfile> {
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

    const documents = groupDocumentUrls(student.documents);

    const universities = await this.universitiesService.findAll();
    const formUrlByUniversityId = new Map(
      universities.map((university) => [university.id, university.formUrl]),
    );

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
        desiredField: student.desiredField ?? undefined,
      },
      education: [...student.education]
        .sort((a, b) => this.educationRank(a.level) - this.educationRank(b.level))
        .map((education) => ({
        level:
          education.level === 'school' || education.level === 'higher'
            ? education.level
            : undefined,
        degree: education.degree ?? undefined,
        institution: education.institution ?? undefined,
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
        id: target.id,
        universityRaw: target.universityRaw,
        universityId: target.universityId ?? undefined,
        formUrl: target.universityId
          ? formUrlByUniversityId.get(target.universityId)
          : undefined,
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

  async findOne(id: string) {
    return this.prisma.student.findUniqueOrThrow({ where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      const batches = await tx.applicationBatch.findMany({
        where: { studentId: id },
        select: { id: true },
      });
      const batchIds = batches.map((batch) => batch.id);

      if (batchIds.length > 0) {
        const applications = await tx.application.findMany({
          where: { batchId: { in: batchIds } },
          select: { id: true },
        });
        const applicationIds = applications.map((application) => application.id);

        if (applicationIds.length > 0) {
          await tx.applicationStep.deleteMany({
            where: { applicationId: { in: applicationIds } },
          });
        }

        await tx.application.deleteMany({
          where: { batchId: { in: batchIds } },
        });
        await tx.applicationBatch.deleteMany({ where: { studentId: id } });
      }

      await tx.generatedDocument.deleteMany({ where: { studentId: id } });
      await tx.studentDocument.deleteMany({ where: { studentId: id } });
      await tx.applicationTarget.deleteMany({ where: { studentId: id } });
      await tx.education.deleteMany({ where: { studentId: id } });
      await tx.workExperience.deleteMany({ where: { studentId: id } });
      await tx.languageSkill.deleteMany({ where: { studentId: id } });
      await tx.familyMember.deleteMany({ where: { studentId: id } });
      await tx.guarantor.deleteMany({ where: { studentId: id } });
      await tx.emergencyContact.deleteMany({ where: { studentId: id } });
      await tx.student.delete({ where: { id } });
    });
  }

  async setApplicationTargetsByFormUrls(
    studentId: string,
    input: { formUrls?: string[] },
  ) {
    if (!Array.isArray(input.formUrls)) {
      throw new BadRequestException('formUrls must be an array of strings.');
    }

    await this.findOne(studentId);

    const existingTargets = await this.prisma.applicationTarget.findMany({
      where: { studentId },
      orderBy: { id: 'asc' },
    });
    const shared = {
      degree: existingTargets.find((target) => target.degree)?.degree ?? undefined,
      major: existingTargets.find((target) => target.major)?.major ?? undefined,
      duration:
        existingTargets.find((target) => target.duration)?.duration ?? undefined,
      fundingSource:
        existingTargets.find((target) => target.fundingSource)?.fundingSource ??
        undefined,
    };

    const resolvedUniversities: Array<{
      id: string;
      displayName: string;
    }> = [];
    const seenUniversityIds = new Set<string>();

    for (const formUrl of input.formUrls) {
      const university =
        await this.universitiesService.resolveByFormUrl(formUrl);

      if (seenUniversityIds.has(university.id)) {
        continue;
      }

      seenUniversityIds.add(university.id);
      resolvedUniversities.push({
        id: university.id,
        displayName: university.displayName,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.applicationTarget.deleteMany({ where: { studentId } });

      if (resolvedUniversities.length === 0) {
        return;
      }

      await tx.applicationTarget.createMany({
        data: resolvedUniversities.map((university) => ({
          studentId,
          universityRaw: university.displayName,
          universityId: university.id,
          degree: shared.degree,
          major: shared.major,
          duration: shared.duration,
          fundingSource: shared.fundingSource,
        })),
      });
    });

    return this.getFullProfile(studentId);
  }

  async resolveApplicationTarget(
    studentId: string,
    input: { universityRaw: string; universityId: string },
  ) {
    const universityRaw = input.universityRaw.trim();
    const universityId = input.universityId.trim();

    if (!universityRaw) {
      throw new BadRequestException('universityRaw is required.');
    }

    if (!universityId) {
      throw new BadRequestException('universityId is required.');
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
      throw new BadRequestException(
        `Application target "${universityRaw}" was not found for this student.`,
      );
    }

    return this.getFullProfile(studentId);
  }

  private buildEducationCreates(raw: unknown) {
    const entries = this.toArray<EducationInput>(
      raw as EducationInput[] | undefined,
    );
    // Webhook: [0]=school (institution/periods + degree/major), [1]=higher (institution/periods)
    const school = entries[0];
    const higher = entries[1];

    const schoolInstitution = school?.institution?.trim() || undefined;
    const higherInstitution = higher?.institution?.trim() || undefined;
    const hasHigherPeriods = Boolean(
      higher?.periodStart || higher?.periodEnd,
    );
    const hasHigher = hasHigherPeriods || Boolean(higherInstitution);
    const hasSchoolPeriods = Boolean(
      school?.periodStart || school?.periodEnd,
    );
    const degree = school?.degree?.trim() || undefined;
    const major = school?.major?.trim() || undefined;

    const creates: Array<{
      level: string;
      degree: string | null;
      institution: string | null;
      major: string | null;
      periodStart: Date | null;
      periodEnd: Date | null;
    }> = [];

    if (hasHigher) {
      // education.0 in profile = highest (uni schemas / fillers)
      creates.push({
        level: 'higher',
        degree: degree ?? null,
        institution: higherInstitution ?? null,
        major: major ?? null,
        periodStart: this.toDate(higher?.periodStart),
        periodEnd: this.toDate(higher?.periodEnd),
      });

      if (hasSchoolPeriods || schoolInstitution) {
        creates.push({
          level: 'school',
          degree: null,
          institution: schoolInstitution ?? null,
          major: null,
          periodStart: this.toDate(school?.periodStart),
          periodEnd: this.toDate(school?.periodEnd),
        });
      }
    } else if (hasSchoolPeriods || schoolInstitution || degree) {
      creates.push({
        level: 'school',
        degree: degree ?? null,
        institution: schoolInstitution ?? null,
        major: major ?? null,
        periodStart: this.toDate(school?.periodStart),
        periodEnd: this.toDate(school?.periodEnd),
      });
    }

    return creates.filter(
      (education) =>
        education.degree ||
        education.institution ||
        education.periodStart ||
        education.periodEnd,
    );
  }

  private educationRank(level?: string | null) {
    if (level === 'higher') {
      return 0;
    }
    if (level === 'school') {
      return 1;
    }
    return 2;
  }

  private hasContactData(contact?: ContactInput) {
    return Boolean(contact?.name?.trim());
  }

  private toContactCreateData(contact: ContactInput) {
    return {
      name: contact.name!.trim(),
      relationship: contact.relationship?.trim() || 'Not specified',
      nationality: contact.nationality?.trim() || undefined,
      company: contact.company?.trim() || undefined,
      position: contact.position?.trim() || undefined,
      homeAddress: contact.homeAddress?.trim() || undefined,
      phone: contact.phone?.trim() || undefined,
      email: contact.email?.trim() || undefined,
    };
  }

  private parseFamilyMembers(
    data: Record<string, any>,
  ): Array<{
    fullName: string;
    relationship: string;
    nationality?: string;
    company?: string;
    position?: string;
    phone?: string;
    email?: string;
  }> {
    const fromArray = this.toArray<FamilyMemberInput>(data.familyMembers)
      .filter((member) => member?.fullName?.trim())
      .map((member) => ({
        fullName: member.fullName!.trim(),
        relationship: member.relationship?.trim() || 'Not specified',
        nationality: member.nationality?.trim() || undefined,
        company: member.company?.trim() || undefined,
        position: member.position?.trim() || undefined,
        phone: member.phone?.trim() || undefined,
        email: member.email?.trim() || undefined,
      }));

    if (fromArray.length > 0) {
      return fromArray;
    }

    const family = data.family ?? {};
    const relatives: Array<{ role: string; member?: FamilyRelativeInput }> = [
      { role: 'father', member: family.father },
      { role: 'mother', member: family.mother },
    ];

    return relatives
      .filter((relative) => relative.member?.fullName?.trim())
      .map((relative) => ({
        fullName: relative.member!.fullName!.trim(),
        relationship: relative.role,
        nationality: relative.member!.nationality?.trim() || undefined,
        company: relative.member!.company?.trim() || undefined,
        position: relative.member!.position?.trim() || undefined,
        phone: relative.member!.phone?.trim() || undefined,
        email: relative.member!.email?.trim() || undefined,
      }));
  }

  private parseTargets(
    raw: string | string[] | undefined,
    shared: Omit<ApplicationTargetInput, 'universityRaw'>,
  ): ApplicationTargetInput[] {
    const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw];

    const targets = list
      .map((universityRaw) => universityRaw.trim())
      .filter(Boolean)
      .map((universityRaw) => ({ universityRaw, ...shared }));

    // Form no longer asks for Application School — still persist major/degree/funding
    if (
      targets.length === 0 &&
      (shared.major || shared.degree || shared.fundingSource || shared.duration)
    ) {
      return [{ universityRaw: 'Unassigned', ...shared }];
    }

    return targets;
  }

  private toArray<T>(value: T[] | undefined): T[] {
    return Array.isArray(value) ? value : [];
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return false;
    }

    const normalized = value.trim().toLowerCase();

    if (['yes', 'true', 'да', 'y', '1'].includes(normalized)) {
      return true;
    }

    // Google Form bilingual options: "Да / Yes", "Нет / No"
    if (/(^|[^a-zа-я])(yes|да|true)([^a-zа-я]|$)/i.test(normalized)) {
      return true;
    }

    return false;
  }

  private toDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(String(value));

    return Number.isNaN(date.getTime()) ? null : date;
  }
}
