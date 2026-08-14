"use client";

import { useState, type FormEvent } from "react";
import {
  saveMyGuarantor,
  updateStudentGuarantor,
  type MyGuarantorInput,
} from "@/features/students/api/students.api";
import type { StudentProfile } from "@/features/students/types/student.types";
import { useT } from "@/lib/i18n/context";
import {
  AddressField,
  ErrorBanner,
  Field,
  PhoneField,
  StepActions,
  StepSection,
  extractErrorMessage,
} from "./shared";

export function GuarantorStep({
  initial,
  studentId,
  onNext,
  onBack,
}: {
  initial: MyGuarantorInput;
  studentId?: string;
  onNext: (profile: StudentProfile) => void;
  onBack?: () => void;
}) {
  const t = useT();
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
      const profile = studentId
        ? await updateStudentGuarantor(studentId, fields)
        : await saveMyGuarantor(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title={t.profileWizard.guarantor.section}>
        <Field
          label={t.profileWizard.guarantor.fullName}
          placeholder="Bekzat Yusupov"
          value={fields.name}
          onChange={(v) => updateField("name", v)}
          required
        />
        <Field
          label={t.profileWizard.guarantor.relationship}
          placeholder="Father"
          value={fields.relationship ?? ""}
          onChange={(v) => updateField("relationship", v)}
        />
        <PhoneField
          label={t.profileWizard.guarantor.phone}
          placeholder="+7 701 234 5678"
          value={fields.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label={t.profileWizard.guarantor.email}
          type="email"
          placeholder="guarantor@example.com"
          value={fields.email ?? ""}
          onChange={(v) => updateField("email", v)}
        />
        <AddressField
          label={t.profileWizard.guarantor.homeAddress}
          placeholder="456 Oak St, Almaty"
          value={fields.homeAddress ?? ""}
          onChange={(v) => updateField("homeAddress", v)}
        />
      </StepSection>

      <StepActions onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  );
}
