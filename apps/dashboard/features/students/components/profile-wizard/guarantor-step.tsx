"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyGuarantor,
  type MyGuarantorInput,
} from "@/features/students/api/students.api";
import type { StudentProfile } from "@/features/students/types/student.types";
import {
  ErrorBanner,
  Field,
  StepActions,
  StepSection,
  extractErrorMessage,
} from "./shared";

export function GuarantorStep({
  initial,
  onNext,
  onBack,
}: {
  initial: MyGuarantorInput;
  onNext: (profile: StudentProfile) => void;
  onBack: () => void;
}) {
  const [fields, setFields] = useState<MyGuarantorInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof MyGuarantorInput>(
    key: K,
    value: MyGuarantorInput[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const profile = await saveMyGuarantor(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title="Guarantor">
        <Field
          label="Full name"
          value={fields.name}
          onChange={(v) => updateField("name", v)}
          required
        />
        <Field
          label="Relationship"
          placeholder="Father"
          value={fields.relationship ?? ""}
          onChange={(v) => updateField("relationship", v)}
        />
        <Field
          label="Phone"
          value={fields.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label="Email"
          type="email"
          value={fields.email ?? ""}
          onChange={(v) => updateField("email", v)}
        />
        <Field
          label="Home address"
          value={fields.homeAddress ?? ""}
          onChange={(v) => updateField("homeAddress", v)}
        />
      </StepSection>

      <StepActions onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  );
}
