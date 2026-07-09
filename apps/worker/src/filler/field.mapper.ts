import { Injectable } from '@nestjs/common';
import type { FieldConfig, StudentProfile } from '@uni-apply/shared';
import get from 'lodash/get.js';

@Injectable()
export class FieldMapper {
  getValue(
    profile: StudentProfile,
    field: FieldConfig,
    motivationLetterContent?: string,
  ): unknown {
    if (field.type === 'essay' && !field.mapsTo) {
      return motivationLetterContent;
    }

    if (!field.mapsTo) {
      return undefined;
    }

    return get(profile, field.mapsTo);
  }
}

