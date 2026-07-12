"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStudents } from "../api/students.api";
import type { StudentListItem } from "../types/student.types";

export function StudentList() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      ) : error ? (
        <StateCard title="Ошибка" description={error} tone="danger" />
      ) : students.length === 0 ? (
        <StateCard
          title="Пока нет студентов"
          description="Заявки должны прийти через Google Form. Ручное создание вынесено за MVP."
        />
      ) : (
        <div className="grid gap-3">
          {students.map((student) => (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              className="group rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] active:scale-[0.99]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-950">
                    {student.givenName} {student.surname}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {student.email}
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    {formatTargets(student)}
                  </div>
                </div>
                <div className="text-sm text-slate-400 tabular-nums">
                  {formatDate(student.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTargets(student: StudentListItem) {
  const targets = student.applicationTargets
    .map((target) => target.universityRaw)
    .filter(Boolean);

  return targets.length > 0 ? targets.join(", ") : "Вузы не указаны";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
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
