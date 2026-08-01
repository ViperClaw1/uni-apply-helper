"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApplicationTargetsPanel } from "@/features/applications/components/application-targets-panel";
import { BatchPanel } from "@/features/applications/components/batch-panel";
import { MotivationLettersPanel } from "@/features/letters/components/motivation-letters-panel";
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
import { toTitleCase } from "@/lib/format";
import { getStudentProfile } from "../api/students.api";
import type {
  ApplicationTarget,
  ContactInfo,
  StudentProfile,
} from "../types/student.types";

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
  const [highlightUniversityId, setHighlightUniversityId] = useState<string>();

  const loadDocuments = useCallback(async () => {
    setDocuments(await getStudentDocuments(studentId));
  }, [studentId]);

  const loadBatches = useCallback(async () => {
    setBatches(await getApplicationBatches(studentId));
  }, [studentId]);

  const loadProfile = useCallback(async () => {
    setStudent(await getStudentProfile(studentId));
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
    function syncHashHighlight() {
      const match = window.location.hash.match(/^#motivation-letter-(.+)$/);

      setHighlightUniversityId(match?.[1]);
    }

    syncHashHighlight();
    window.addEventListener("hashchange", syncHashHighlight);

    return () => window.removeEventListener("hashchange", syncHashHighlight);
  }, []);

  useEffect(() => {
    if (!latestBatch || !isActiveBatch(latestBatch.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadBatches().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [latestBatch, loadBatches]);

  const documentsByType = useMemo(() => {
    const groupedDocuments = new Map<string, StudentDocument[]>();

    for (const document of documents) {
      const documentsForType = groupedDocuments.get(document.type) ?? [];
      documentsForType.push(document);
      groupedDocuments.set(document.type, documentsForType);
    }

    for (const [type, documentsForType] of groupedDocuments) {
      documentsForType.sort(
        (left, right) =>
          new Date(right.uploadedAt).getTime() -
          new Date(left.uploadedAt).getTime(),
      );
      groupedDocuments.set(type, documentsForType);
    }

    return groupedDocuments;
  }, [documents]);

  const resolvedTargets = useMemo(
    () =>
      student?.applicationTargets.filter((target) =>
        Boolean(target.universityId),
      ) ?? [],
    [student?.applicationTargets],
  );

  const submittedUniversityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const batch of batches) {
      for (const application of batch.applications) {
        if (application.status === "submitted") {
          ids.add(application.universityId);
        }
      }
    }
    return ids;
  }, [batches]);

  const pendingTargets = useMemo(
    () =>
      resolvedTargets.filter(
        (target) =>
          target.universityId && !submittedUniversityIds.has(target.universityId),
      ),
    [resolvedTargets, submittedUniversityIds],
  );

  function handleTargetsChange(targets: ApplicationTarget[]) {
    setStudent((current) =>
      current ? { ...current, applicationTargets: targets } : current,
    );
  }

  async function handleCreateBatch() {
    if (resolvedTargets.length === 0) {
      setSubmitError("Сначала добавьте хотя бы один вуз по URL формы.");
      return;
    }

    if (pendingTargets.length === 0) {
      setSubmitError("Все добавленные вузы уже имеют отправленные заявки.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createApplicationBatch(studentId);
      await Promise.all([loadBatches(), loadProfile()]);
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
              {resolvedTargets.length > 0
                ? resolvedTargets
                    .map((target) => target.universityRaw)
                    .join(", ")
                : "Не выбраны — добавьте URL ниже"}
            </div>
          </div>
        </div>
      </section>

      {student.guarantor || student.emergencyContact ? (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {student.guarantor ? (
            <ContactInfoCard
              title="Гарант"
              variant="guarantor"
              contact={student.guarantor}
            />
          ) : null}
          {student.emergencyContact ? (
            <ContactInfoCard
              title="Экстренный контакт"
              variant="emergency"
              contact={student.emergencyContact}
            />
          ) : null}
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Документы
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Загрузите файлы — система сама распознает данные из документов.
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
                accept={documentType.accept}
                parse={documentType.parse}
                multiple={documentType.multiple}
                existingDocuments={documentsByType.get(documentType.key)}
                onUploaded={loadDocuments}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-8">
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Вузы
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Добавьте ссылки на формы подачи — вузы появятся в списке автоматически.
              </p>
            </div>

            <ApplicationTargetsPanel
              studentId={studentId}
              targets={student.applicationTargets}
              onTargetsChange={handleTargetsChange}
            />
          </section>

          <MotivationLettersPanel
            student={student}
            highlightUniversityId={highlightUniversityId}
          />

          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Подача заявок
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Нажмите «Отправить заявки» — система проверит документы и заполнит
                формы вузов. Если что-то пойдёт не так, ошибка появится ниже;
                форму можно открыть и дозаполнить вручную.
              </p>
            </div>

            <BatchPanel
              batch={latestBatch}
              studentId={studentId}
              onApplicationsChange={loadBatches}
            />

            {submitError ? (
              <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
                {submitError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleCreateBatch}
              disabled={isSubmitting || pendingTargets.length === 0}
              className="mt-4 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60"
            >
              {isSubmitting
                ? "Запускаем..."
                : resolvedTargets.length === 0
                  ? "Добавьте вузы для батча"
                  : pendingTargets.length === 0
                    ? "Все заявки уже отправлены"
                    : `Отправить заявки (${pendingTargets.length})`}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function formatStudentName(student: { givenName?: string; surname?: string }) {
  const name = [student.givenName, student.surname]
    .filter((part): part is string => Boolean(part))
    .map(toTitleCase)
    .join(" ");

  return name || "Имя не указано";
}

function ContactInfoCard({
  title,
  contact,
  variant,
}: {
  title: string;
  contact: ContactInfo;
  variant: "guarantor" | "emergency";
}) {
  const accent =
    variant === "guarantor"
      ? {
          iconBg: "bg-sky-50 text-sky-700 ring-sky-100",
          badge: "bg-sky-50 text-sky-800 ring-sky-200",
        }
      : {
          iconBg: "bg-amber-50 text-amber-700 ring-amber-100",
          badge: "bg-amber-50 text-amber-800 ring-amber-200",
        };

  const rows = [
    {
      key: "phone",
      value: contact.phone,
      icon: PhoneIcon,
      href: contact.phone ? `tel:${contact.phone}` : undefined,
    },
    {
      key: "email",
      value: contact.email,
      icon: MailIcon,
      href: contact.email ? `mailto:${contact.email}` : undefined,
    },
    {
      key: "address",
      value: contact.homeAddress,
      icon: MapPinIcon,
    },
  ].filter((row) => row.value);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.05)] ring-1 ring-black/5 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${accent.iconBg}`}
        >
          {variant === "guarantor" ? <ShieldIcon /> : <AlertIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            {contact.relationship ? (
              <span
                className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold capitalize ring-1 ${accent.badge}`}
              >
                {contact.relationship}
              </span>
            ) : null}
          </div>
          {contact.name ? (
            <p className="mt-1 truncate text-sm font-medium text-slate-800">
              {contact.name}
            </p>
          ) : null}
        </div>
      </div>

      {rows.length > 0 ? (
        <ul className="mt-3 grid gap-1.5">
          {rows.map((row) => {
            const Icon = row.icon;
            const content = (
              <>
                <span className="mt-0.5 shrink-0 text-slate-400">
                  <Icon />
                </span>
                <span className="min-w-0 break-words">{row.value}</span>
              </>
            );

            return (
              <li key={row.key}>
                {row.href ? (
                  <a
                    href={row.href}
                    className="flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-700">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 5 6v6c0 4.5 2.9 7.4 7 8.5 4.1-1.1 7-4 7-8.5V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m9.5 12 1.8 1.8 3.7-3.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 9v4.5M12 17h.01M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
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
