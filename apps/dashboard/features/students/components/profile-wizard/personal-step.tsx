"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyProfile,
  updateStudentProfile,
  type MyProfileInput,
} from "@/features/students/api/students.api";
import { COUNTRIES, flagEmoji } from "@/features/auth/lib/countries";
import type { StudentDocument } from "@/features/documents/types/document.types";
import type { StudentProfile } from "@/features/students/types/student.types";
import { useT } from "@/lib/i18n/context";
import {
  AddressField,
  CheckboxField,
  ErrorBanner,
  Field,
  PhoneField,
  SelectField,
  StepActions,
  StepSection,
  extractErrorMessage,
} from "./shared";

const NATIONALITY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.name,
  label: `${flagEmoji(country.code)} ${country.name}`,
}));

export function PersonalStep({
  initial,
  studentId,
  onNext,
  passportDocument,
}: {
  initial: MyProfileInput;
  studentId?: string;
  onNext: (profile: StudentProfile) => void;
  passportDocument?: StudentDocument;
}) {
  const t = useT();
  const [fields, setFields] = useState<MyProfileInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedPassport = extractParsedPassport(passportDocument);
  useDefaultedFromParse(parsedPassport.passportNo, fields.passportNo ?? "", (value) =>
    updateField("passportNo", value),
  );
  useDefaultedFromParse(parsedPassport.passportExpiry, fields.passportExpiry ?? "", (value) =>
    updateField("passportExpiry", value),
  );
  useDefaultedFromParse(parsedPassport.cityOfBirth, fields.cityOfBirth ?? "", (value) =>
    updateField("cityOfBirth", value),
  );
  useDefaultedFromParse(parsedPassport.dateOfBirth, fields.dateOfBirth ?? "", (value) =>
    updateField("dateOfBirth", value),
  );

  const SEX_OPTIONS = [
    { value: "Male", label: t.profileWizard.personal.sexOptions.male },
    { value: "Female", label: t.profileWizard.personal.sexOptions.female },
  ];

  const RELIGION_OPTIONS = [
    { value: "None", label: t.profileWizard.personal.religionOptions.none },
    { value: "Christianity", label: t.profileWizard.personal.religionOptions.christianity },
    { value: "Islam", label: t.profileWizard.personal.religionOptions.islam },
    { value: "Buddhism", label: t.profileWizard.personal.religionOptions.buddhism },
    { value: "Hinduism", label: t.profileWizard.personal.religionOptions.hinduism },
    { value: "Judaism", label: t.profileWizard.personal.religionOptions.judaism },
    { value: "Other", label: t.profileWizard.personal.religionOptions.other },
  ];

  function updateField<K extends keyof MyProfileInput>(
    key: K,
    value: MyProfileInput[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const profile = studentId
        ? await updateStudentProfile(studentId, fields)
        : await saveMyProfile(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title={t.profileWizard.personal.sectionBasic}>
        <Field
          label={t.profileWizard.personal.surname}
          placeholder="Ivanova"
          value={fields.surname}
          onChange={(v) => updateField("surname", v)}
          required
        />
        <Field
          label={t.profileWizard.personal.givenName}
          placeholder="Anna"
          value={fields.givenName}
          onChange={(v) => updateField("givenName", v)}
          required
        />
        <SelectField
          label={t.profileWizard.personal.sex}
          value={fields.sex ?? ""}
          onChange={(v) => updateField("sex", v)}
          options={SEX_OPTIONS}
        />
        <SelectField
          label={t.profileWizard.personal.nationality}
          value={fields.nationality ?? ""}
          onChange={(v) => updateField("nationality", v)}
          options={NATIONALITY_OPTIONS}
        />
        <Field
          label={t.profileWizard.personal.cityOfBirth}
          placeholder="Almaty"
          value={fields.cityOfBirth ?? ""}
          onChange={(v) => updateField("cityOfBirth", v)}
        />
        <Field
          label={t.profileWizard.personal.dateOfBirth}
          type="date"
          value={fields.dateOfBirth ?? ""}
          onChange={(v) => updateField("dateOfBirth", v)}
        />
        <Field
          label={t.profileWizard.personal.chineseName}
          placeholder="安娜"
          value={fields.chineseName ?? ""}
          onChange={(v) => updateField("chineseName", v)}
        />
        <SelectField
          label={t.profileWizard.personal.religion}
          value={fields.religion ?? ""}
          onChange={(v) => updateField("religion", v)}
          options={RELIGION_OPTIONS}
        />
        <Field
          label={t.profileWizard.personal.maritalStatus}
          placeholder="Single"
          value={fields.maritalStatus ?? ""}
          onChange={(v) => updateField("maritalStatus", v)}
        />
      </StepSection>

      <StepSection title={t.profileWizard.personal.sectionPassport}>
        <Field
          label={t.profileWizard.personal.passportNo}
          placeholder="N01234567"
          value={fields.passportNo ?? ""}
          onChange={(v) => updateField("passportNo", v)}
        />
        <Field
          label={t.profileWizard.personal.passportExpiry}
          type="date"
          value={fields.passportExpiry ?? ""}
          onChange={(v) => updateField("passportExpiry", v)}
        />
        <Field
          label={t.profileWizard.personal.consulate}
          placeholder="Beijing"
          value={fields.consulate ?? ""}
          onChange={(v) => updateField("consulate", v)}
        />
      </StepSection>

      <StepSection title={t.profileWizard.personal.sectionContact}>
        <Field
          label={t.profileWizard.personal.email}
          type="email"
          placeholder="you@example.com"
          value={fields.email}
          onChange={(v) => updateField("email", v)}
          required
        />
        <PhoneField
          label={t.profileWizard.personal.phone}
          value={fields.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
          placeholder={t.profileWizard.personal.phonePlaceholder}
        />
        <AddressField
          label={t.profileWizard.personal.permanentAddress}
          placeholder="123 Main St, Almaty"
          value={fields.permanentAddress ?? ""}
          onChange={(v) => updateField("permanentAddress", v)}
        />
        <Field
          label={t.profileWizard.personal.postCode}
          placeholder="050000"
          value={fields.postCode ?? ""}
          onChange={(v) => updateField("postCode", v)}
        />
      </StepSection>

      <StepSection title={t.profileWizard.personal.sectionBackground}>
        <Field
          label={t.profileWizard.personal.currentInstitution}
          placeholder="Al-Farabi KazNU"
          value={fields.currentInstitution ?? ""}
          onChange={(v) => updateField("currentInstitution", v)}
        />
        <Field
          label={t.profileWizard.personal.hobby}
          placeholder="Reading, chess"
          value={fields.hobby ?? ""}
          onChange={(v) => updateField("hobby", v)}
        />
        <Field
          label={t.profileWizard.personal.desiredField}
          placeholder="Computer Science"
          value={fields.desiredField ?? ""}
          onChange={(v) => updateField("desiredField", v)}
        />
        <div className="flex flex-col justify-center gap-2">
          <CheckboxField
            label={t.profileWizard.personal.beenToChina}
            checked={fields.beenToChina ?? false}
            onChange={(v) => updateField("beenToChina", v)}
          />
          <CheckboxField
            label={t.profileWizard.personal.studiedInChina}
            checked={fields.studiedInChina ?? false}
            onChange={(v) => updateField("studiedInChina", v)}
          />
        </div>
      </StepSection>

      <StepActions isSubmitting={isSubmitting} />
    </form>
  );
}

function extractParsedPassport(document?: StudentDocument): {
  passportNo?: string;
  passportExpiry?: string;
  cityOfBirth?: string;
  dateOfBirth?: string;
} {
  if (
    !document ||
    document.parseStatus !== "parsed" ||
    !document.parsedData ||
    typeof document.parsedData !== "object"
  ) {
    return {};
  }

  const data = document.parsedData as Record<string, unknown>;

  return {
    passportNo: readTrimmedString(data.passportNo),
    passportExpiry: normalizeDateInput(data.passportExpiry),
    cityOfBirth: readTrimmedString(data.cityOfBirth),
    dateOfBirth: normalizeDateInput(data.dateOfBirth),
  };
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

// OCR output isn't guaranteed to be ISO — normalize the common formats we've seen
// (ISO already, or DD.MM.YYYY) into what <input type="date"> requires.
function normalizeDateInput(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const dotted = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

// Renders-time "adjust state when external data changes" (React's own sanctioned pattern for
// this — see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
// Applies the parsed value as a default whenever it changes, but only while the field still
// matches the last value *we* applied (or is empty) — a manual edit away from that permanently
// opts the field out of further auto-fill, so a later re-parse never clobbers a human correction.
function useDefaultedFromParse(
  parsedValue: string | undefined,
  currentValue: string,
  applyValue: (value: string) => void,
) {
  const [lastApplied, setLastApplied] = useState<string | undefined>(undefined);

  if (parsedValue !== lastApplied) {
    setLastApplied(parsedValue);

    if (parsedValue && (!currentValue || currentValue === lastApplied)) {
      applyValue(parsedValue);
    }
  }
}
