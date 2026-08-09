"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyEmergencyContact,
  type MyEmergencyContactInput,
} from "@/features/students/api/students.api";
import type { StudentProfile } from "@/features/students/types/student.types";
import {
  ErrorBanner,
  Field,
  StepActions,
  StepSection,
  extractErrorMessage,
} from "./shared";

export function EmergencyContactStep({
  initial,
  onNext,
  onBack,
}: {
  initial: MyEmergencyContactInput;
  onNext: (profile: StudentProfile) => void;
  onBack: () => void;
}) {
  const [fields, setFields] = useState<MyEmergencyContactInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof MyEmergencyContactInput>(
    key: K,
    value: MyEmergencyContactInput[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const profile = await saveMyEmergencyContact(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title="Emergency contact">
        <Field
          label="Full name"
          placeholder="Dana Yusupova"
          value={fields.name}
          onChange={(v) => updateField("name", v)}
          required
        />
        <Field
          label="Relationship"
          placeholder="Sister"
          value={fields.relationship ?? ""}
          onChange={(v) => updateField("relationship", v)}
        />
        <Field
          label="Phone"
          placeholder="+7 701 987 6543"
          value={fields.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label="Email"
          type="email"
          placeholder="contact@example.com"
          value={fields.email ?? ""}
          onChange={(v) => updateField("email", v)}
        />
      </StepSection>

      <StepActions onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  );
}
