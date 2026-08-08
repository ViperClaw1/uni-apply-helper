import Link from "next/link";
import { toTitleCase } from "@/lib/format";
import type { StudentProfile } from "../types/student.types";

export function MyProfileCard({ student }: { student: StudentProfile | null }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Uni Apply</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            My profile
          </h1>
        </div>
        <BackButton />
      </header>

      {student ? <FilledCard student={student} /> : <EmptyCard />}
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h2 className="text-lg font-semibold text-slate-950">
        You haven&apos;t filled in your profile yet
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Add your basic details so universities can find them on your
        applications.
      </p>
      <Link
        href="/dashboard/profile"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96]"
      >
        Fill in your profile
      </Link>
    </div>
  );
}

function FilledCard({ student }: { student: StudentProfile }) {
  const name = [student.personal.givenName, student.personal.surname]
    .filter(Boolean)
    .map(toTitleCase)
    .join(" ");
  const targets = student.applicationTargets
    .map((target) => target.universityRaw)
    .filter(Boolean);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="text-base font-semibold text-slate-950">
        {name || "Name not set"}
      </div>
      <div className="mt-1 text-sm text-slate-500">{student.personal.email}</div>

      {targets.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {targets.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/70"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-400">No universities yet</div>
      )}

      <Link
        href="/dashboard/profile"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
      >
        Edit profile
      </Link>
    </div>
  );
}

function BackButton() {
  return (
    <Link
      href="/"
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
    >
      <BackIcon />
      Back
    </Link>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5m0 0 7 7m-7-7 7-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
