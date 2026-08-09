"use client";

import { useState, type FormEvent } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  saveMyProfile,
  type MyProfileInput,
} from "@/features/students/api/students.api";
import { COUNTRIES, flagEmoji } from "@/features/auth/lib/countries";
import type { StudentProfile } from "@/features/students/types/student.types";
import {
  CheckboxField,
  ErrorBanner,
  Field,
  SelectField,
  StepActions,
  StepSection,
  extractErrorMessage,
} from "./shared";

const SEX_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
];

const RELIGION_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Christianity", label: "Christianity" },
  { value: "Islam", label: "Islam" },
  { value: "Buddhism", label: "Buddhism" },
  { value: "Hinduism", label: "Hinduism" },
  { value: "Judaism", label: "Judaism" },
  { value: "Other", label: "Other" },
];

const NATIONALITY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.name,
  label: `${flagEmoji(country.code)} ${country.name}`,
}));

export function PersonalStep({
  initial,
  onNext,
}: {
  initial: MyProfileInput;
  onNext: (profile: StudentProfile) => void;
}) {
  const [fields, setFields] = useState<MyProfileInput>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const profile = await saveMyProfile(fields);
      onNext(profile);
    } catch (submitError) {
      setError(extractErrorMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <StepSection title="Basic information">
        <Field
          label="Surname"
          placeholder="Ivanova"
          value={fields.surname}
          onChange={(v) => updateField("surname", v)}
          required
        />
        <Field
          label="Given name"
          placeholder="Anna"
          value={fields.givenName}
          onChange={(v) => updateField("givenName", v)}
          required
        />
        <SelectField
          label="Sex"
          value={fields.sex ?? ""}
          onChange={(v) => updateField("sex", v)}
          options={SEX_OPTIONS}
        />
        <SelectField
          label="Nationality"
          value={fields.nationality ?? ""}
          onChange={(v) => updateField("nationality", v)}
          options={NATIONALITY_OPTIONS}
        />
        <Field
          label="City of birth"
          placeholder="Almaty"
          value={fields.cityOfBirth ?? ""}
          onChange={(v) => updateField("cityOfBirth", v)}
        />
        <Field
          label="Date of birth"
          type="date"
          value={fields.dateOfBirth ?? ""}
          onChange={(v) => updateField("dateOfBirth", v)}
        />
        <Field
          label="Chinese name (if any)"
          placeholder="安娜"
          value={fields.chineseName ?? ""}
          onChange={(v) => updateField("chineseName", v)}
        />
        <SelectField
          label="Religion"
          value={fields.religion ?? ""}
          onChange={(v) => updateField("religion", v)}
          options={RELIGION_OPTIONS}
        />
        <Field
          label="Marital status"
          placeholder="Single"
          value={fields.maritalStatus ?? ""}
          onChange={(v) => updateField("maritalStatus", v)}
        />
      </StepSection>

      <StepSection title="Passport & visa">
        <Field
          label="Passport number"
          placeholder="N01234567"
          value={fields.passportNo ?? ""}
          onChange={(v) => updateField("passportNo", v)}
        />
        <Field
          label="Passport expiry"
          type="date"
          value={fields.passportExpiry ?? ""}
          onChange={(v) => updateField("passportExpiry", v)}
        />
        <Field
          label="Consulate applying for visa"
          placeholder="Beijing"
          value={fields.consulate ?? ""}
          onChange={(v) => updateField("consulate", v)}
        />
      </StepSection>

      <StepSection title="Contact">
        <Field
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={fields.email}
          onChange={(v) => updateField("email", v)}
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Phone</label>
          <PhoneInput
            value={(fields.phone ?? "").replace(/^\+/, "")}
            onChange={(value) => updateField("phone", `+${value}`)}
            placeholder="Enter your phone number"
            inputClass="!h-10 !w-full !rounded-lg !border !border-slate-200 !text-sm !text-slate-800"
            buttonClass="!rounded-l-lg !border !border-slate-200"
            containerClass="!w-full"
          />
        </div>
        <Field
          label="Permanent address"
          placeholder="123 Main St, Almaty"
          value={fields.permanentAddress ?? ""}
          onChange={(v) => updateField("permanentAddress", v)}
        />
        <Field
          label="Post code"
          placeholder="050000"
          value={fields.postCode ?? ""}
          onChange={(v) => updateField("postCode", v)}
        />
      </StepSection>

      <StepSection title="Background">
        <Field
          label="Current employer or institution"
          placeholder="Al-Farabi KazNU"
          value={fields.currentInstitution ?? ""}
          onChange={(v) => updateField("currentInstitution", v)}
        />
        <Field
          label="Hobby"
          placeholder="Reading, chess"
          value={fields.hobby ?? ""}
          onChange={(v) => updateField("hobby", v)}
        />
        <Field
          label="Desired field of study"
          placeholder="Computer Science"
          value={fields.desiredField ?? ""}
          onChange={(v) => updateField("desiredField", v)}
        />
        <div className="flex flex-col justify-center gap-2">
          <CheckboxField
            label="I have been to China before"
            checked={fields.beenToChina ?? false}
            onChange={(v) => updateField("beenToChina", v)}
          />
          <CheckboxField
            label="I have studied or worked in China before"
            checked={fields.studiedInChina ?? false}
            onChange={(v) => updateField("studiedInChina", v)}
          />
        </div>
      </StepSection>

      <StepActions isSubmitting={isSubmitting} />
    </form>
  );
}
