"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Header, Logo, LogoutButton } from "@/components/header";
import { useLocale, useT } from "@/lib/i18n/context";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { getAllApplications } from "@/features/applications/api/applications.api";
import { getApplicationStatusLabel, getStatusClassName } from "@/features/applications/lib/status";
import type { ApplicationListItem } from "@/features/applications/types/application.types";
import { useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import { getUniversities } from "../api/universities.api";
import type { UniversitySummary } from "../types/university.types";

type UniversityRow = UniversitySummary & {
  applications: ApplicationListItem[];
  /** Most recent applicant — used as the row/Apply target, since the per-student Universities
   * subtab this links into always needs a specific studentId. */
  latestStudentId?: string;
};

export function UniversitiesList({ companyName }: { companyName?: string } = {}) {
  const t = useT();
  const { locale } = useLocale();
  const documentTypeLabel = useDocumentTypeLabel();
  const router = useRouter();

  const {
    data: universitiesData,
    error: universitiesLoadError,
    isLoading,
  } = useCachedFetch("universities", getUniversities);
  const { data: applicationsData, error: applicationsLoadError } = useCachedFetch(
    "all-applications",
    getAllApplications,
  );

  const universities = universitiesData ?? [];
  const loadError =
    universitiesLoadError || applicationsLoadError ? t.universities.list.loadFailed : null;

  const rows: UniversityRow[] = useMemo(() => {
    const applicationsByUniversity = new Map<string, ApplicationListItem[]>();

    for (const application of applicationsData ?? []) {
      const list = applicationsByUniversity.get(application.universityId) ?? [];
      list.push(application);
      applicationsByUniversity.set(application.universityId, list);
    }

    return universities.map((university) => {
      const applications = (applicationsByUniversity.get(university.id) ?? []).sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );

      return {
        ...university,
        applications,
        latestStudentId: applications[0]?.studentId,
      };
    });
  }, [universities, applicationsData]);

  function targetHref(row: UniversityRow): string | undefined {
    return row.latestStudentId
      ? `/students/${row.latestStudentId}?tab=universities#motivation-letter-${row.id}`
      : undefined;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <Header
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Logo />
            {companyName || t.universities.list.eyebrow}
          </span>
        }
        title={t.universities.list.title}
        actions={<LogoutButton />}
      />

      {isLoading ? (
        <StateCard title={t.universities.list.loadingTitle} description={t.universities.list.loadingDesc} />
      ) : loadError && universities.length === 0 ? (
        <StateCard title={t.common.error} description={loadError} tone="danger" />
      ) : universities.length === 0 ? (
        <StateCard title={t.universities.list.emptyTitle} description={t.universities.list.emptyDesc} />
      ) : (
        <div className="flex flex-col gap-4">
          {loadError ? (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {loadError}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                  <th className="px-5 py-3">{t.universities.list.columnUniversity}</th>
                  <th className="px-5 py-3">{t.universities.list.columnDocuments}</th>
                  <th className="px-5 py-3">{t.universities.list.columnApplications}</th>
                  <th className="px-5 py-3">{t.universities.list.columnFormUrl}</th>
                  <th className="px-5 py-3 text-right">{t.universities.list.columnAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = targetHref(row);

                  return (
                    <tr
                      key={row.id}
                      onClick={href ? () => router.push(href) : undefined}
                      className={`border-b border-slate-50 last:border-0 align-top hover:bg-slate-50/60 ${
                        href ? "cursor-pointer" : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UniversityPlaceholderIcon />
                          <div className="min-w-0 truncate text-sm font-semibold text-slate-950">
                            {row.displayName}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {row.requiredDocuments.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {row.requiredDocuments.map((type) => (
                              <div key={type} className="flex items-center gap-1.5 text-slate-600">
                                <DocumentIcon />
                                {documentTypeLabel(type)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.applications.length === 0 ? (
                          <span className="text-slate-400">{t.universities.list.noApplications}</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {row.applications.map((application) => (
                              <div key={application.id} className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-medium ring-1 ${getStatusClassName(application.status)}`}
                                >
                                  {getApplicationStatusLabel(application.status, t)}
                                </span>
                                <span className="truncate text-slate-700">
                                  {application.studentName}
                                </span>
                                <span className="shrink-0 text-slate-400">
                                  #{application.id.slice(0, 8)} · {formatDate(application.createdAt, locale)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={row.formUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                        >
                          {t.universities.list.linkLabel}
                          <ArrowIcon />
                        </a>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {href ? (
                          <a
                            href={href}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                          >
                            {t.universities.list.applyButton}
                          </a>
                        ) : (
                          <span
                            title={t.universities.list.noStudentsTooltip}
                            className="inline-flex h-8 cursor-not-allowed items-center rounded-lg px-3 text-xs font-semibold text-slate-300 ring-1 ring-slate-100"
                          >
                            {t.universities.list.applyButton}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string, locale: "en" | "ru") {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US").format(new Date(value));
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
          tone === "danger" ? "text-lg font-semibold text-rose-700" : "text-lg font-semibold text-slate-950"
        }
      >
        {title}
      </h2>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

// Placeholder — no photo field exists on UniversitySchema yet.
function UniversityPlaceholderIcon() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-black/5">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="m12 3 9 5-9 5-9-5 9-5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
