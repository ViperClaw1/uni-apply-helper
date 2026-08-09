"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyFamily,
  type FamilyRelativeInput,
  type MyFamilyInput,
} from "@/features/students/api/students.api";
import { COUNTRIES, flagEmoji } from "@/features/auth/lib/countries";
import type { StudentProfile } from "@/features/students/types/student.types";
import {
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

export function FamilyStep({
  initial,
  onNext,
  onBack,
}: {
  initial: MyFamilyInput;
  onNext: (profile: StudentProfile) => void;
  onBack: () => void;
}) {
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
      const profile = await saveMyFamily(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title="Father">
        <Field
          label="Full name"
          placeholder="Bekzat Yusupov"
          value={fields.father?.fullName ?? ""}
          onChange={(v) => updateRelative("father", "fullName", v)}
        />
        <SelectField
          label="Nationality"
          value={fields.father?.nationality ?? ""}
          onChange={(v) => updateRelative("father", "nationality", v)}
          options={NATIONALITY_OPTIONS}
        />
        <Field
          label="Phone"
          placeholder="+7 701 234 5678"
          value={fields.father?.phone ?? ""}
          onChange={(v) => updateRelative("father", "phone", v)}
        />
        <Field
          label="Email"
          type="email"
          placeholder="father@example.com"
          value={fields.father?.email ?? ""}
          onChange={(v) => updateRelative("father", "email", v)}
        />
        <Field
          label="Work place"
          placeholder="Oil Corp"
          value={fields.father?.company ?? ""}
          onChange={(v) => updateRelative("father", "company", v)}
        />
        <Field
          label="Job"
          placeholder="Engineer"
          value={fields.father?.position ?? ""}
          onChange={(v) => updateRelative("father", "position", v)}
        />
      </StepSection>

      <StepSection title="Mother">
        <Field
          label="Full name"
          placeholder="Aigerim Yusupova"
          value={fields.mother?.fullName ?? ""}
          onChange={(v) => updateRelative("mother", "fullName", v)}
        />
        <SelectField
          label="Nationality"
          value={fields.mother?.nationality ?? ""}
          onChange={(v) => updateRelative("mother", "nationality", v)}
          options={NATIONALITY_OPTIONS}
        />
        <Field
          label="Phone"
          placeholder="+7 701 111 2233"
          value={fields.mother?.phone ?? ""}
          onChange={(v) => updateRelative("mother", "phone", v)}
        />
        <Field
          label="Email"
          type="email"
          placeholder="mother@example.com"
          value={fields.mother?.email ?? ""}
          onChange={(v) => updateRelative("mother", "email", v)}
        />
        <Field
          label="Work place"
          value={fields.mother?.company ?? ""}
          onChange={(v) => updateRelative("mother", "company", v)}
        />
        <Field
          label="Job"
          value={fields.mother?.position ?? ""}
          onChange={(v) => updateRelative("mother", "position", v)}
        />
      </StepSection>

      <StepActions
        onBack={onBack}
        isSubmitting={isSubmitting}
        continueLabel="Finish"
      />
    </form>
  );
}
