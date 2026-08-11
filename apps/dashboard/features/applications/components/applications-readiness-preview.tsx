"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { getApplicationsReadiness } from "../api/applications.api";
import type { ApplicationReadiness, ApplicationReadinessStatus } from "../types/application.types";

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
  const [items, setItems] = useState<ApplicationReadiness[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getApplicationsReadiness(studentId)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setItems(data);
        setError(null);
        onReadyCountChange?.(data.filter((item) => item.status === "ready").length);
      })
      .catch(() => {
        if (isMounted) {
          setError(p.loadFailed);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, refreshKey]);

  if (error) {
    return (
      <div className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
        {error}
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
