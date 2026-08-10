"use client";

import { useState, type FormEvent } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  saveMyProfile,
  updateStudentProfile,
  type MyProfileInput,
} from "@/features/students/api/students.api";
import { COUNTRIES, flagEmoji } from "@/features/auth/lib/countries";
import type { StudentProfile } from "@/features/students/types/student.types";
import { useT } from "@/lib/i18n/context";
import {
  CheckboxField,
  ErrorBanner,
  Field,
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
}: {
  initial: MyProfileInput;
  studentId?: string;
  onNext: (profile: StudentProfile) => void;
}) {
  const t = useT();
  const [fields, setFields] = useState<MyProfileInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">{t.profileWizard.personal.phone}</label>
          <PhoneInput
            value={(fields.phone ?? "").replace(/^\+/, "")}
            onChange={(value) => updateField("phone", `+${value}`)}
            placeholder={t.profileWizard.personal.phonePlaceholder}
            inputClass="!h-10 !w-full !rounded-lg !border !border-slate-200 !text-sm !text-slate-800"
            buttonClass="!rounded-l-lg !border !border-slate-200"
            containerClass="!w-full"
          />
        </div>
        <Field
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
