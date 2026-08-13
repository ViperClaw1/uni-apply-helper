"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyEmergencyContact,
  updateStudentEmergencyContact,
  type MyEmergencyContactInput,
} from "@/features/students/api/students.api";
import type { StudentProfile } from "@/features/students/types/student.types";
import { useT } from "@/lib/i18n/context";
import {
  ErrorBanner,
  Field,
  PhoneField,
  StepActions,
  StepSection,
  extractErrorMessage,
} from "./shared";

export function EmergencyContactStep({
  initial,
  studentId,
  onNext,
  onBack,
}: {
  initial: MyEmergencyContactInput;
  studentId?: string;
  onNext: (profile: StudentProfile) => void;
  onBack?: () => void;
}) {
  const t = useT();
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
      const profile = studentId
        ? await updateStudentEmergencyContact(studentId, fields)
        : await saveMyEmergencyContact(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title={t.profileWizard.emergencyContact.section}>
        <Field
          label={t.profileWizard.emergencyContact.fullName}
          placeholder="Dana Yusupova"
          value={fields.name}
          onChange={(v) => updateField("name", v)}
          required
        />
        <Field
          label={t.profileWizard.emergencyContact.relationship}
          placeholder="Sister"
          value={fields.relationship ?? ""}
          onChange={(v) => updateField("relationship", v)}
        />
        <PhoneField
          label={t.profileWizard.emergencyContact.phone}
          placeholder="+7 701 987 6543"
          value={fields.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label={t.profileWizard.emergencyContact.email}
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
