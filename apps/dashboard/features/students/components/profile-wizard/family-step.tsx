"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyFamily,
  updateStudentFamily,
  type FamilyRelativeInput,
  type MyFamilyInput,
} from "@/features/students/api/students.api";
import { COUNTRIES, flagEmoji } from "@/features/auth/lib/countries";
import type { StudentProfile } from "@/features/students/types/student.types";
import { useT } from "@/lib/i18n/context";
import {
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

export function FamilyStep({
  initial,
  studentId,
  onNext,
  onBack,
}: {
  initial: MyFamilyInput;
  studentId?: string;
  onNext: (profile: StudentProfile) => void;
  onBack?: () => void;
}) {
  const t = useT();
  const [fields, setFields] = useState<MyFamilyInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRelative(
    relative: "father" | "mother",
    key: keyof FamilyRelativeInput,
    value: string,
  ) {
    setFields((current) => ({
      ...current,
      [relative]: { ...current[relative], [key]: value },
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const profile = studentId
        ? await updateStudentFamily(studentId, fields)
        : await saveMyFamily(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title={t.profileWizard.family.father}>
        <Field
          label={t.profileWizard.family.fullName}
          placeholder="Bekzat Yusupov"
          value={fields.father?.fullName ?? ""}
          onChange={(v) => updateRelative("father", "fullName", v)}
        />
        <SelectField
          label={t.profileWizard.family.nationality}
          value={fields.father?.nationality ?? ""}
          onChange={(v) => updateRelative("father", "nationality", v)}
          options={NATIONALITY_OPTIONS}
        />
        <PhoneField
          label={t.profileWizard.family.phone}
          placeholder="+7 701 234 5678"
          value={fields.father?.phone ?? ""}
          onChange={(v) => updateRelative("father", "phone", v)}
        />
        <Field
          label={t.profileWizard.family.email}
          type="email"
          placeholder="father@example.com"
          value={fields.father?.email ?? ""}
          onChange={(v) => updateRelative("father", "email", v)}
        />
        <Field
          label={t.profileWizard.family.workplace}
          placeholder="Oil Corp"
          value={fields.father?.company ?? ""}
          onChange={(v) => updateRelative("father", "company", v)}
        />
        <Field
          label={t.profileWizard.family.job}
          placeholder="Engineer"
          value={fields.father?.position ?? ""}
          onChange={(v) => updateRelative("father", "position", v)}
        />
      </StepSection>

      <StepSection title={t.profileWizard.family.mother}>
        <Field
          label={t.profileWizard.family.fullName}
          placeholder="Aigerim Yusupova"
          value={fields.mother?.fullName ?? ""}
          onChange={(v) => updateRelative("mother", "fullName", v)}
        />
        <SelectField
          label={t.profileWizard.family.nationality}
          value={fields.mother?.nationality ?? ""}
          onChange={(v) => updateRelative("mother", "nationality", v)}
          options={NATIONALITY_OPTIONS}
        />
        <PhoneField
          label={t.profileWizard.family.phone}
          placeholder="+7 701 111 2233"
          value={fields.mother?.phone ?? ""}
          onChange={(v) => updateRelative("mother", "phone", v)}
        />
        <Field
          label={t.profileWizard.family.email}
          type="email"
          placeholder="mother@example.com"
          value={fields.mother?.email ?? ""}
          onChange={(v) => updateRelative("mother", "email", v)}
        />
        <Field
          label={t.profileWizard.family.workplace}
          value={fields.mother?.company ?? ""}
          onChange={(v) => updateRelative("mother", "company", v)}
        />
        <Field
          label={t.profileWizard.family.job}
          value={fields.mother?.position ?? ""}
          onChange={(v) => updateRelative("mother", "position", v)}
        />
      </StepSection>

      <StepActions
        onBack={onBack}
        isSubmitting={isSubmitting}
        continueLabel={t.profileWizard.family.finish}
      />
    </form>
  );
}
