"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import type {
  UniversitySession,
  UniversitySessionStatus,
} from "@/features/universities/types/session.types";
import { RenewSessionModal } from "./renew-session-modal";

const STATUS_CLASSES: Record<UniversitySessionStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  expired: "bg-rose-100 text-rose-800 ring-rose-200",
  login_required: "bg-amber-100 text-amber-800 ring-amber-200",
  attention_required: "bg-amber-100 text-amber-800 ring-amber-200",
  checking: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function UniversitySessionsPanel({
  sessions,
  onRenewed,
}: {
  sessions: UniversitySession[];
  onRenewed: () => void;
}) {
  const t = useT();
  const [renewing, setRenewing] = useState<UniversitySession | null>(null);

  const activeCount = useMemo(
    () => sessions.filter((session) => session.status === "active").length,
    [sessions],
  );
  const needsAttentionCount = sessions.length - activeCount;

  const statusLabel: Record<UniversitySessionStatus, string> = {
    active: t.dashboard.sessions.statusActive,
    expired: t.dashboard.sessions.statusExpired,
    login_required: t.dashboard.sessions.statusLoginRequired,
    attention_required: t.dashboard.sessions.statusAttentionRequired,
    checking: t.dashboard.sessions.statusChecking,
  };

  return (
    <section className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-950">{t.dashboard.sessions.title}</h2>
        <div className="text-sm text-slate-500">
          {sessions.length}
          {t.dashboard.sessions.totalSuffix} · {activeCount}
          {t.dashboard.sessions.activeSuffix}
          {needsAttentionCount > 0
            ? ` · ${needsAttentionCount}${t.dashboard.sessions.needAttentionSuffix}`
            : ""}
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          {t.dashboard.sessions.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                <th className="px-6 py-3">{t.dashboard.sessions.columnUniversity}</th>
                <th className="px-6 py-3">{t.dashboard.sessions.columnSession}</th>
                <th className="px-6 py-3">{t.dashboard.sessions.columnApplications}</th>
                <th className="px-6 py-3 text-right">{t.dashboard.sessions.columnAction}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.universityId}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-6 py-3 font-medium text-slate-950">{session.displayName}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${STATUS_CLASSES[session.status]}`}
                    >
                      {statusLabel[session.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 tabular-nums text-slate-700">
                    {session.applications}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {session.status !== "active" ? (
                      <button
                        type="button"
                        onClick={() => setRenewing(session)}
                        className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                      >
                        {session.status === "login_required"
                          ? t.dashboard.sessions.logIn
                          : session.status === "attention_required"
                            ? t.dashboard.sessions.resolve
                            : t.dashboard.sessions.renewSession}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RenewSessionModal
        session={renewing}
        onClose={() => setRenewing(null)}
        onRenewed={() => {
          setRenewing(null);
          onRenewed();
        }}
      />
    </section>
  );
}
