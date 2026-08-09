"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyEducation,
  type EducationLevelInput,
  type MyEducationInput,
} from "@/features/students/api/students.api";
import type { StudentProfile } from "@/features/students/types/student.types";
import {
  ErrorBanner,
  Field,
  StepActions,
  StepSection,
  YearField,
  extractErrorMessage,
} from "./shared";

export function EducationStep({
  initial,
  onNext,
  onBack,
}: {
  initial: MyEducationInput;
  onNext: (profile: StudentProfile) => void;
  onBack: () => void;
}) {
  const [fields, setFields] = useState<MyEducationInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLevel(
    level: "school" | "higher",
    key: keyof EducationLevelInput,
    value: string | number | undefined,
  ) {
    setFields((current) => ({
      ...current,
      [level]: { ...current[level], [key]: value },
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const profile = await saveMyEducation(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title="Secondary education (school)">
        <Field
          label="School name"
          placeholder="School 123"
          value={fields.school?.institution ?? ""}
          onChange={(v) => updateLevel("school", "institution", v)}
        />
        <Field
          label="Degree"
          placeholder="High School Diploma"
          value={fields.school?.degree ?? ""}
          onChange={(v) => updateLevel("school", "degree", v)}
        />
        <Field
          label="Major"
          placeholder="General"
          value={fields.school?.major ?? ""}
          onChange={(v) => updateLevel("school", "major", v)}
        />
        <div className="grid grid-cols-2 gap-4">
          <YearField
            label="Start year"
            value={fields.school?.periodStartYear}
            onChange={(v) => updateLevel("school", "periodStartYear", v)}
          />
          <YearField
            label="End year"
            value={fields.school?.periodEndYear}
            onChange={(v) => updateLevel("school", "periodEndYear", v)}
          />
        </div>
      </StepSection>

      <StepSection title="Higher education">
        <Field
          label="Institution"
          placeholder="Peking University"
          value={fields.higher?.institution ?? ""}
          onChange={(v) => updateLevel("higher", "institution", v)}
        />
        <Field
          label="Degree"
          placeholder="Bachelor's"
          value={fields.higher?.degree ?? ""}
          onChange={(v) => updateLevel("higher", "degree", v)}
        />
        <Field
          label="Major"
          placeholder="Computer Science"
          value={fields.higher?.major ?? ""}
          onChange={(v) => updateLevel("higher", "major", v)}
        />
        <div className="grid grid-cols-2 gap-4">
          <YearField
            label="Start year"
            value={fields.higher?.periodStartYear}
            onChange={(v) => updateLevel("higher", "periodStartYear", v)}
          />
          <YearField
            label="End year"
            value={fields.higher?.periodEndYear}
            onChange={(v) => updateLevel("higher", "periodEndYear", v)}
          />
        </div>
      </StepSection>

      <StepSection title="Languages">
        <Field
          label="Chinese level (HSK score)"
          placeholder="HSK 4"
          value={fields.chineseLevel ?? ""}
          onChange={(v) => setFields((current) => ({ ...current, chineseLevel: v }))}
        />
        <Field
          label="English level"
          placeholder="IELTS 6.5"
          value={fields.englishLevel ?? ""}
          onChange={(v) => setFields((current) => ({ ...current, englishLevel: v }))}
        />
      </StepSection>

      <StepActions onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  );
}
