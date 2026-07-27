import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
export declare class FieldMapper {
    getValue(profile: StudentProfile, field: FieldConfig, motivationLetterContent?: string): unknown;
    private resolvePathValue;
    private pathsInclude;
    private resolveResearchArea;
    private getUnmappedDefault;
    private firstRealOption;
    private normalizeSex;
    private normalizeMaritalStatus;
    private normalizeYesNo;
}
