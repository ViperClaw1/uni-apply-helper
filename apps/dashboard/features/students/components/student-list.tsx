"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toTitleCase } from "@/lib/format";
import { deleteStudent, getStudents } from "../api/students.api";
import type { StudentListItem } from "../types/student.types";

export function StudentList() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getStudents()
      .then((data) => {
        if (isMounted) {
          setStudents(data);
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Не удалось загрузить студентов.");
        }
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

  async function handleDelete(student: StudentListItem) {
    const name = formatStudentName(student);
    const confirmed = window.confirm(
      `Удалить профиль «${name}»? Это действие нельзя отменить.`,
    );

    if (!confirmed || deletingId) {
      return;
    }

    setDeletingId(student.id);

    try {
      await deleteStudent(student.id);
      setStudents((current) => current.filter((item) => item.id !== student.id));
    } catch {
      setError("Не удалось удалить студента.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Uni Apply</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Студенты
          </h1>
        </div>
        <Link
          href="/students/new"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96]"
        >
          Создать вручную
        </Link>
      </header>

      {isLoading ? (
        <StateCard title="Загружаем студентов" description="Секунду..." />
      ) : error && students.length === 0 ? (
        <StateCard title="Ошибка" description={error} tone="danger" />
      ) : students.length === 0 ? (
        <StateCard
          title="Пока нет студентов"
          description="Заявки должны прийти через Google Form. Ручное создание вынесено за MVP."
        />
      ) : (
        <div className="grid gap-3">
          {error ? (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          ) : null}
          {students.map((student) => {
            const targets = student.applicationTargets
              .map((target) => target.universityRaw)
              .filter(Boolean);

            return (
              <div
                key={student.id}
                className="group flex items-start gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
              >
                <Link
                  href={`/students/${student.id}`}
                  className="min-w-0 flex-1 active:scale-[0.99]"
                >
                  <div className="text-base font-semibold text-slate-950">
                    {formatStudentName(student)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <span className="shrink-0 text-slate-400">
                      <MailIcon />
                    </span>
                    <span className="truncate">
                      {student.email || "Email не указан"}
                    </span>
                  </div>
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
                    <div className="mt-3 text-sm text-slate-400">
                      Вузы не указаны
                    </div>
                  )}
                </Link>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-sm text-slate-400 tabular-nums">
                    {formatDate(student.createdAt)}
                  </div>
                  <button
                    type="button"
                    title="Удалить студента"
                    aria-label="Удалить студента"
                    disabled={deletingId === student.id}
                    onClick={() => handleDelete(student)}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatStudentName(student: Pick<StudentListItem, "givenName" | "surname">) {
  const name = [student.givenName, student.surname]
    .filter((part): part is string => Boolean(part))
    .map(toTitleCase)
    .join(" ");

  return name || "Имя не указано";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m22 8-10 7L2 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StateCard({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h2
        className={
          tone === "danger"
            ? "text-lg font-semibold text-rose-700"
            : "text-lg font-semibold text-slate-950"
        }
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
