"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header, Logo } from "@/components/header";
import { useT } from "@/lib/i18n/context";
import { toTitleCase } from "@/lib/format";
import { getApplicationBatches } from "@/features/applications/api/applications.api";
import { getApplicationStatusLabel } from "@/features/applications/lib/status";
import type { ApplicationBatch } from "@/features/applications/types/application.types";
import type { StudentProfile } from "../types/student.types";

export function MyProfileCard({ student }: { student: StudentProfile | null }) {
  const t = useT();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-8">
      <Header
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Logo />
            {t.students.myProfile.brand}
          </span>
        }
        title={t.students.myProfile.title}
        actions={<BackButton />}
      />

      {student ? <ApplicationCards student={student} /> : <EmptyCard />}
    </div>
  );
}

function EmptyCard() {
  const t = useT();

  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h2 className="text-lg font-semibold text-slate-950">
        {t.students.myProfile.emptyTitle}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        {t.students.myProfile.emptyDesc}
      </p>
      <Link
        href="/dashboard/profile"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96]"
      >
        {t.students.myProfile.fillProfile}
      </Link>
    </div>
  );
}

function ApplicationCards({ student }: { student: StudentProfile }) {
  const [batches, setBatches] = useState<ApplicationBatch[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    getApplicationBatches(student.id)
      .then((data) => {
        if (isMounted) {
          setBatches(
            [...data].sort(
              (left, right) =>
                new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
            ),
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setBatches([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [student.id]);

  if (batches === null) {
    return null;
  }

  if (batches.length === 0) {
    return <ApplicationCard student={student} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {batches.map((batch) => (
        <ApplicationCard key={batch.id} student={student} batch={batch} />
      ))}
    </div>
  );
}

function ApplicationCard({
  student,
  batch,
}: {
  student: StudentProfile;
  batch?: ApplicationBatch;
}) {
  const t = useT();
  const name = [student.personal.givenName, student.personal.surname]
    .filter(Boolean)
    .map(toTitleCase)
    .join(" ");
  const photoUrl = firstUrl(student.documents.photo);

  const universities = batch
    ? batch.applications.map((application) => ({
        key: application.id,
        name: application.universityDisplayName ?? application.universityId,
        status: getApplicationStatusLabel(application.status, t),
      }))
    : student.applicationTargets
        .filter((target) => target.universityRaw)
        .map((target) => ({
          key: target.id ?? target.universityRaw,
          name: target.universityRaw,
          status: null,
        }));

  const buttonLabel = !batch
    ? t.students.myProfile.startApplication
    : batch.submitted > 0
      ? t.students.myProfile.viewDetails
      : t.students.myProfile.editApplication;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <PhotoAvatar url={photoUrl} name={name || t.common.nameNotSet} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-slate-950">
            {name || t.common.nameNotSet}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">
            {student.personal.email || t.common.emailNotProvided}
          </div>
          {student.personal.phone ? (
            <div className="text-sm text-slate-500">{student.personal.phone}</div>
          ) : null}
        </div>
      </div>

      {universities.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-4">
          {universities.map((university) => (
            <li
              key={university.key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-slate-700">{university.name}</span>
              {university.status ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/70">
                  {university.status}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-400">
          {t.students.myProfile.noUniversitiesYet}
        </div>
      )}

      <Link
        href="/dashboard/profile"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
      >
        {buttonLabel}
      </Link>
    </div>
  );
}

function PhotoAvatar({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-black/5"
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500 ring-1 ring-black/5">
      {initial}
    </span>
  );
}

function firstUrl(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function BackButton() {
  const t = useT();

  return (
    <Link
      href="/"
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
    >
      <BackIcon />
      {t.common.back}
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
