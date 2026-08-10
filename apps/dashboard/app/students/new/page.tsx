"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Header, LogoutButton } from "@/components/header";
import { AgencyShell } from "@/components/agency-shell";
import {
  ErrorBanner,
  Field,
  extractErrorMessage,
} from "@/features/students/components/profile-wizard/shared";
import {
  createStudent,
  type CreateStudentInput,
} from "@/features/students/api/students.api";
import { useT } from "@/lib/i18n/context";

const EMPTY: CreateStudentInput = { surname: "", givenName: "", email: "", phone: "" };

export default function NewStudentPage() {
  const t = useT();
  const router = useRouter();
  const [fields, setFields] = useState<CreateStudentInput>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof CreateStudentInput>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const student = await createStudent(fields);
      router.push(`/students/${student.id}`);
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
      setIsSubmitting(false);
    }
  }

  return (
    <AgencyShell active="students">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
        <Header
          eyebrow={t.students.newStudent.eyebrow}
          title={t.students.newStudent.title}
          actions={<LogoutButton />}
        />

        <Link
          href="/dashboard"
          className="mb-6 -mt-4 inline-flex h-10 w-fit items-center rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-950"
        >
          {t.students.newStudent.backToList}
        </Link>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.05)] ring-1 ring-black/5"
        >
          <ErrorBanner message={error} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.students.newStudent.surname}
              placeholder="Ivanova"
              value={fields.surname}
              onChange={(v) => updateField("surname", v)}
              required
            />
            <Field
              label={t.students.newStudent.givenName}
              placeholder="Anna"
              value={fields.givenName}
              onChange={(v) => updateField("givenName", v)}
              required
            />
            <Field
              label={t.students.newStudent.email}
              type="email"
              placeholder="you@example.com"
              value={fields.email}
              onChange={(v) => updateField("email", v)}
              required
            />
            <Field
              label={t.students.newStudent.phone}
              placeholder="+7 707 123 4567"
              value={fields.phone ?? ""}
              onChange={(v) => updateField("phone", v)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting ? t.students.newStudent.creating : t.students.newStudent.create}
          </button>
        </form>
      </div>
    </AgencyShell>
  );
}
