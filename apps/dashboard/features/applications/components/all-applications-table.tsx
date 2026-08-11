"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { getAllApplications } from "../api/applications.api";
import { getApplicationStatusLabel, getStatusClassName } from "../lib/status";
import type { ApplicationListItem, ApplicationStatus } from "../types/application.types";

type FilterValue = "all" | ApplicationStatus;

export function AllApplicationsTable() {
  const t = useT();
  const [applications, setApplications] = useState<ApplicationListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");

  useEffect(() => {
    let isMounted = true;

    getAllApplications()
      .then((data) => {
        if (isMounted) {
          setApplications(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(t.applications.list.loadFailed);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo<FilterValue[]>(() => {
    const statuses = new Set<ApplicationStatus>();

    for (const application of applications ?? []) {
      statuses.add(application.status);
    }

    return ["all", ...Array.from(statuses)];
  }, [applications]);

  const filteredApplications = useMemo(
    () => (applications ?? []).filter((application) => filter === "all" || application.status === filter),
    [applications, filter],
  );

  if (!applications) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <StateCard title={error ?? t.common.loading} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
        {t.applications.list.title}
      </h1>

      {error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium ring-1 transition-colors ${
              filter === value
                ? "bg-slate-950 text-white ring-slate-950"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {value === "all" ? t.applications.list.filterAll : getApplicationStatusLabel(value, t)}
          </button>
        ))}
      </div>

      {filteredApplications.length === 0 ? (
        <StateCard
          title={
            applications.length === 0
              ? t.applications.list.empty
              : t.applications.list.emptyFiltered
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                <th className="px-5 py-3">{t.applications.list.columnStudent}</th>
                <th className="px-5 py-3">{t.applications.list.columnUniversity}</th>
                <th className="px-5 py-3">{t.applications.list.columnStatus}</th>
                <th className="px-5 py-3 text-right">{t.applications.list.columnAction}</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application) => (
                <tr
                  key={application.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3 font-medium text-slate-950">
                    {application.studentName}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {application.universityDisplayName ?? application.universityId}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${getStatusClassName(application.status)}`}
                    >
                      {getApplicationStatusLabel(application.status, t)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {/* ponytail: links to the student's page rather than a dedicated per-application
                        detail screen — no such route exists yet; add one when consultant review
                        needs to live outside the student's Applications tab. */}
                    <Link
                      href={`/students/${application.studentId}`}
                      className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                    >
                      {["blocked", "waiting_for_login", "attention_required"].includes(
                        application.status,
                      )
                        ? t.applications.list.actionFix
                        : t.applications.list.actionView}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StateCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
    </div>
  );
}
