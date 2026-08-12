"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/context";
import { Skeleton } from "@/components/skeleton";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { getApplicationsReadiness } from "../api/applications.api";
import type { ApplicationReadinessStatus } from "../types/application.types";

type ApplicationsReadinessPreviewProps = {
  studentId: string;
  refreshKey: string;
  onReadyCountChange?: (count: number) => void;
};

export function ApplicationsReadinessPreview({
  studentId,
  refreshKey,
  onReadyCountChange,
}: ApplicationsReadinessPreviewProps) {
  const t = useT();
  const p = t.applications.readinessPreview;

  const {
    data,
    error: loadError,
    isLoading,
  } = useCachedFetch(`readiness:${studentId}:${refreshKey}`, () =>
    getApplicationsReadiness(studentId),
  );
  const items = data ?? [];

  useEffect(() => {
    if (data) {
      onReadyCountChange?.(data.filter((item) => item.status === "ready").length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) {
    return (
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
        {p.loadFailed}
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h3 className="text-sm font-semibold text-slate-950">{p.title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.universityId ?? item.universityRaw} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-700">{item.universityRaw}</span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusColor(item.status)}`}
              >
                {statusDot(item.status)} {p[item.status]}
              </span>
            </div>
            {item.status === "blocked" && item.blockedReason ? (
              <div className="text-xs text-amber-700">{item.blockedReason}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusColor(status: ApplicationReadinessStatus) {
  switch (status) {
    case "ready":
      return "text-emerald-700";
    case "blocked":
      return "text-amber-700";
    case "submitted":
      return "text-slate-500";
    default:
      return "text-slate-500";
  }
}

function statusDot(status: ApplicationReadinessStatus) {
  return status === "ready" ? "🟢" : status === "blocked" ? "🟡" : "⚪";
}
