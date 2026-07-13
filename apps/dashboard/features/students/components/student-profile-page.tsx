"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BatchPanel } from "@/features/applications/components/batch-panel";
import {
  createApplicationBatch,
  getApplicationBatches,
} from "@/features/applications/api/applications.api";
import { isActiveBatch } from "@/features/applications/lib/status";
import type { ApplicationBatch } from "@/features/applications/types/application.types";
import { DEFAULT_DOCUMENT_TYPES } from "@/features/documents/constants/document-types";
import { DocumentUploader } from "@/features/documents/components/document-uploader";
import { getStudentDocuments } from "@/features/documents/api/documents.api";
import type { StudentDocument } from "@/features/documents/types/document.types";
import { getStudentProfile } from "../api/students.api";
import type { StudentProfile } from "../types/student.types";

export function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [batches, setBatches] = useState<ApplicationBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setDocuments(await getStudentDocuments(studentId));
  }, [studentId]);

  const loadBatches = useCallback(async () => {
    setBatches(await getApplicationBatches(studentId));
  }, [studentId]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getStudentProfile(studentId),
      getStudentDocuments(studentId),
      getApplicationBatches(studentId),
    ])
      .then(([profile, studentDocuments, applicationBatches]) => {
        if (isMounted) {
          setStudent(profile);
          setDocuments(studentDocuments);
          setBatches(applicationBatches);
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Не удалось загрузить карточку студента.");
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
  }, [studentId]);

  const latestBatch = batches[0];

  useEffect(() => {
    if (!latestBatch || !isActiveBatch(latestBatch.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadBatches().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [latestBatch, loadBatches]);

  const documentMap = useMemo(() => {
    return new Map(documents.map((document) => [document.type, document]));
  }, [documents]);

  async function handleCreateBatch() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createApplicationBatch(studentId);
      await loadBatches();
    } catch {
      setSubmitError("Не удалось запустить подачу заявок.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <PageShell title="Загрузка..." />;
  }

  if (error || !student) {
    return <PageShell title="Ошибка" description={error ?? "Студент не найден."} />;
  }

  const studentName = formatStudentName(student.personal);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex h-10 w-fit items-center rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-950"
      >
        Назад к студентам
      </Link>

      <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.05)] ring-1 ring-black/5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Карточка студента</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {studentName}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span>{student.personal.email || "Email не указан"}</span>
              {student.personal.phone ? <span>{student.personal.phone}</span> : null}
              {student.personal.passportNo ? (
                <span>Паспорт: {student.personal.passportNo}</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 lg:max-w-sm">
            <div className="font-semibold text-slate-950">Вузы</div>
            <div className="mt-2">
              {student.applicationTargets.length > 0
                ? student.applicationTargets
                    .map((target) => target.universityRaw)
                    .join(", ")
                : "Не указаны"}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Документы
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Загрузка сразу отправляет файл в API, R2 и очередь парсинга.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {DEFAULT_DOCUMENT_TYPES.map((documentType) => (
              <DocumentUploader
                key={documentType.key}
                studentId={studentId}
                type={documentType.key}
                label={documentType.label}
                existingDocument={documentMap.get(documentType.key)}
                onUploaded={loadDocuments}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Подача заявок
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Backend сам валидирует требования, ставит jobs и шлет Telegram.
            </p>
          </div>

          <BatchPanel batch={latestBatch} />

          {submitError ? (
            <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {submitError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleCreateBatch}
            disabled={isSubmitting}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting ? "Запускаем..." : "Отправить заявки во все вузы"}
          </button>
        </section>
      </div>
    </main>
  );
}

function formatStudentName(student: { givenName?: string; surname?: string }) {
  const name = [student.givenName, student.surname].filter(Boolean).join(" ");

  return name || "Имя не указано";
}

function PageShell({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-8">
      <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
    </main>
  );
}
