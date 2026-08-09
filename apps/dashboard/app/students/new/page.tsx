"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";

export default function NewStudentPage() {
  const t = useT();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-8">
      <div className="rounded-3xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.05)] ring-1 ring-black/5">
        <p className="text-sm font-medium text-slate-500">{t.students.newStudent.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {t.students.newStudent.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {t.students.newStudent.description}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.96]"
        >
          {t.students.newStudent.backToList}
        </Link>
      </div>
    </main>
  );
}
