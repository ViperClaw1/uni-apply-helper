"use client";

import { useState } from "react";
import { isMissingApprovedMotivationLetter } from "@/features/letters/lib/letter-utils";
import { openUniversityForm } from "../lib/extension-bridge";
import {
  getApplicationStatusLabel,
  getBatchStatusLabel,
  getStatusClassName,
} from "../lib/status";
import type { ApplicationBatch } from "../types/application.types";

type BatchPanelProps = {
  batch?: ApplicationBatch;
  studentId: string;
};

export function BatchPanel({ batch, studentId }: BatchPanelProps) {
  const [openingApplicationId, setOpeningApplicationId] = useState<string | null>(
    null,
  );

  if (!batch) {
    return (
      <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        Батчи еще не запускались.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            Батч #{batch.id.slice(0, 8)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {new Intl.DateTimeFormat("ru-RU", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(batch.createdAt))}
          </div>
        </div>
        <StatusBadge label={getBatchStatusLabel(batch.status)} status={batch.status} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <Counter label="Всего" value={batch.total} tone="slate" />
        <Counter label="Отправлено" value={batch.submitted} tone="emerald" />
        <Counter label="Блок" value={batch.blocked} tone="amber" />
        <Counter label="Ошибок" value={batch.failed} tone="rose" />
      </div>

      {batch.applications.length > 0 ? (
        <div className="mt-5 divide-y divide-slate-100">
          {batch.applications.map((application) => (
            <div key={application.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">
                    {application.universityDisplayName ?? application.universityId}
                  </div>
                  {application.blockedReason ? (
                    <div className="mt-1 text-xs text-amber-700">
                      {application.blockedReason}
                      {isMissingApprovedMotivationLetter(application.blockedReason) ? (
                        <a
                          href={`#motivation-letter-${application.universityId}`}
                          className="mt-1 block font-semibold text-sky-700 underline-offset-2 hover:underline"
                        >
                          Перейти к мотивационному письму →
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {application.errorMessage ? (
                    <div className="mt-1 text-xs text-rose-700">
                      {application.errorMessage}
                    </div>
                  ) : null}
                  {application.formUrl &&
                  application.status === "ready_for_submission" ? (
                    <button
                      type="button"
                      title="Откроет форму вуза. Extension заполнит поля автоматически, если установлен."
                      disabled={openingApplicationId === application.id}
                      onClick={() => {
                        if (openingApplicationId === application.id) {
                          return;
                        }

                        setOpeningApplicationId(application.id);
                        openUniversityForm({
                          studentId,
                          applicationId: application.id,
                          formUrl: application.formUrl!,
                        });
                        window.setTimeout(
                          () => setOpeningApplicationId(null),
                          1500,
                        );
                      }}
                      className="mt-2 inline-flex h-8 cursor-pointer items-center rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {openingApplicationId === application.id
                        ? "Открываем..."
                        : "Открыть форму →"}
                    </button>
                  ) : null}
                </div>
                <StatusBadge
                  label={getApplicationStatusLabel(application.status)}
                  status={application.status}
                />
              </div>

              {application.steps.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {application.steps.map((step) => (
                    <span
                      key={step.id}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                    >
                      {step.stepName}: {step.status}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "emerald" | "rose" | "slate";
}) {
  const valueClassName = {
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    slate: "text-slate-950",
  }[tone];

  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3">
      <div className={`text-lg font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${getStatusClassName(
        status,
      )}`}
    >
      {label}
    </span>
  );
}
