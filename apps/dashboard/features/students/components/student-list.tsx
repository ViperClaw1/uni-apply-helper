"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Header, Logo, LogoutButton } from "@/components/header";
import { useLocale, useT } from "@/lib/i18n/context";
import { toTitleCase } from "@/lib/format";
import { deleteStudent, getStudents } from "../api/students.api";
import type { StudentListItem } from "../types/student.types";
import { computeProfileReadiness, REQUIRED_DOCUMENT_TYPES } from "../lib/profile-readiness";
import {
  computeStudentStatus,
  getStudentStatusClassName,
  type StudentStatusBucket,
} from "../lib/student-status";
import { ConfirmDialog } from "./confirm-dialog";
import { PhotoAvatar } from "./photo-avatar";
import { StudentKpiTiles, type StudentStatusFilter } from "./student-kpi-tiles";

type StudentRow = StudentListItem & {
  status: StudentStatusBucket;
  profilePercent: number;
  documentsPresent: number;
  universitiesCount: number;
};

export function StudentList({ companyName }: { companyName?: string } = {}) {
  const t = useT();
  const { locale } = useLocale();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentListItem | null>(
    null,
  );
  const [filter, setFilter] = useState<StudentStatusFilter>("all");

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
          setError(t.students.list.loadFailed);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: StudentRow[] = useMemo(
    () =>
      students.map((student) => {
        const documentTypesPresent = new Set(student.documents.map((doc) => doc.type));
        const documentsPresent = REQUIRED_DOCUMENT_TYPES.filter((type) =>
          documentTypesPresent.has(type),
        ).length;
        const readiness = computeProfileReadiness(student, student.documents);
        const universitiesCount = student.applicationTargets.filter((target) =>
          Boolean(target.universityId),
        ).length;

        return {
          ...student,
          status: computeStudentStatus(
            student,
            student.documents,
            student.applicationTargets,
            student.latestBatch,
          ),
          profilePercent: readiness.overallPercent,
          documentsPresent,
          universitiesCount,
        };
      }),
    [students],
  );

  const counts = useMemo<Record<StudentStatusFilter, number>>(
    () => ({
      all: rows.length,
      needs_attention: rows.filter((row) => row.status === "needs_attention").length,
      ready: rows.filter((row) => row.status === "ready").length,
      in_progress: rows.filter((row) => row.status === "in_progress").length,
      submitted: rows.filter((row) => row.status === "submitted").length,
    }),
    [rows],
  );

  const filteredRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );

  const closeDeleteDialog = useCallback(() => {
    if (deletingId) {
      return;
    }

    setStudentToDelete(null);
  }, [deletingId]);

  async function confirmDelete() {
    if (!studentToDelete || deletingId) {
      return;
    }

    setDeletingId(studentToDelete.id);

    try {
      await deleteStudent(studentToDelete.id);
      setStudents((current) =>
        current.filter((item) => item.id !== studentToDelete.id),
      );
      setStudentToDelete(null);
    } catch {
      setError(t.students.list.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  }

  const deleteName = studentToDelete
    ? formatStudentName(studentToDelete.personal, t.common.nameNotSet)
    : "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <Header
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Logo />
            {companyName || t.students.list.eyebrow}
          </span>
        }
        title={t.students.list.title}
        actions={
          <>
            <Link
              href="/students/new"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96]"
            >
              {t.students.list.createManually}
            </Link>
            <LogoutButton />
          </>
        }
      />

      {isLoading ? (
        <StateCard title={t.students.list.loadingTitle} description={t.students.list.loadingDesc} />
      ) : error && students.length === 0 ? (
        <StateCard title={t.common.error} description={error} tone="danger" />
      ) : students.length === 0 ? (
        <StateCard
          title={t.students.list.emptyTitle}
          description={t.students.list.emptyDesc}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          ) : null}

          <StudentKpiTiles counts={counts} active={filter} onChange={setFilter} />

          {filteredRows.length === 0 ? (
            <StateCard
              title={t.students.list.emptyFiltered}
              description=""
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                    <th className="px-5 py-3">{t.students.list.columnStudent}</th>
                    <th className="px-5 py-3">{t.students.list.columnProfile}</th>
                    <th className="px-5 py-3">{t.students.list.columnDocuments}</th>
                    <th className="px-5 py-3">{t.students.list.columnUniversities}</th>
                    <th className="px-5 py-3">{t.students.list.columnStatus}</th>
                    <th className="px-5 py-3 text-right">{t.students.list.columnAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <PhotoAvatar
                            url={student.photoUrl}
                            name={formatStudentName(student.personal, t.common.nameNotSet)}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950">
                              {formatStudentName(student.personal, t.common.nameNotSet)}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {student.personal.email || t.common.emailNotProvided}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-700">
                        {student.profilePercent}%
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-700">
                        {student.documentsPresent}/{REQUIRED_DOCUMENT_TYPES.length}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-700">
                        {student.universitiesCount}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${getStudentStatusClassName(student.status)}`}
                        >
                          {t.students.status[student.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/students/${student.id}`}
                            className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                          >
                            {t.students.list.actionOpen}
                          </Link>
                          <button
                            type="button"
                            title={t.students.list.deleteAria}
                            aria-label={t.students.list.deleteAria}
                            disabled={deletingId === student.id}
                            onClick={() => setStudentToDelete(student)}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-50"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-right text-xs text-slate-400">
            {formatDate(students[0]?.createdAt ?? new Date().toISOString(), locale)}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={studentToDelete !== null}
        title={t.students.list.deleteConfirmTitle}
        description={`${t.students.list.deleteConfirmDescPrefix}${deleteName}${t.students.list.deleteConfirmDescSuffix}`}
        confirmLabel={t.common.delete}
        isPending={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />
    </div>
  );
}

function formatStudentName(
  student: Pick<StudentListItem["personal"], "givenName" | "surname">,
  fallback: string,
) {
  const name = [student.givenName, student.surname]
    .filter((part): part is string => Boolean(part))
    .map(toTitleCase)
    .join(" ");

  return name || fallback;
}

function formatDate(value: string, locale: "en" | "ru") {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US").format(new Date(value));
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
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
