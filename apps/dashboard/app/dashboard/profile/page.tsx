"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  getMyProfile,
  saveMyProfile,
  type MyProfileInput,
} from "@/features/students/api/students.api";

const INITIAL_FIELDS: MyProfileInput = {
  surname: "",
  givenName: "",
  email: "",
  phone: "",
  nationality: "",
  dateOfBirth: "",
  passportNo: "",
};

export default function ProfileFormPage() {
  const router = useRouter();
  const [fields, setFields] = useState<MyProfileInput>(INITIAL_FIELDS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getMyProfile()
      .then((student) => {
        if (!isMounted || !student) {
          return;
        }

        setFields({
          surname: student.personal.surname,
          givenName: student.personal.givenName,
          email: student.personal.email,
          phone: student.personal.phone ?? "",
          nationality: student.personal.nationality ?? "",
          dateOfBirth: student.personal.dateOfBirth?.slice(0, 10) ?? "",
          passportNo: student.personal.passportNo ?? "",
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateField<K extends keyof MyProfileInput>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await saveMyProfile(fields);
      router.push("/dashboard");
    } catch (submitError) {
      setError(
        isAxiosError(submitError) &&
          typeof submitError.response?.data?.message === "string"
          ? submitError.response.data.message
          : "Something went wrong. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Fill in your profile
        </h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          ← Back to dashboard
        </Link>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 sm:grid-cols-2"
      >
        <Field
          label="Surname"
          value={fields.surname}
          onChange={(v) => updateField("surname", v)}
          required
        />
        <Field
          label="Given name"
          value={fields.givenName}
          onChange={(v) => updateField("givenName", v)}
          required
        />
        <Field
          label="Email"
          type="email"
          value={fields.email}
          onChange={(v) => updateField("email", v)}
          required
        />
        <Field
          label="Phone"
          value={fields.phone ?? ""}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label="Nationality"
          value={fields.nationality ?? ""}
          onChange={(v) => updateField("nationality", v)}
        />
        <Field
          label="Date of birth"
          type="date"
          value={fields.dateOfBirth ?? ""}
          onChange={(v) => updateField("dateOfBirth", v)}
        />
        <Field
          label="Passport number"
          value={fields.passportNo ?? ""}
          onChange={(v) => updateField("passportNo", v)}
        />

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
      />
    </div>
  );
}
