"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useT } from "@/lib/i18n/context";
import { isMissingApprovedMotivationLetter } from "@/features/letters/lib/letter-utils";
import {
  formatErrorMessage,
  getStepLabel,
  getStepStatusLabel,
} from "../lib/format-error";
import { sortStepsByPipeline } from "../lib/step-labels";
import {
  canOpenUniversityForm,
  prepareAndOpenUniversityForm,
} from "../lib/open-form";
import {
  getApplicationStatusLabel,
  getBatchStatusLabel,
  getStatusClassName,
} from "../lib/status";
import type {
  ApplicationBatch,
  ApplicationItem,
} from "../types/application.types";

type BatchPanelProps = {
  batch?: ApplicationBatch;
  studentId: string;
  onApplicationsChange?: () => void | Promise<void>;
};

export function BatchPanel({
  batch,
  studentId,
  onApplicationsChange,
}: BatchPanelProps) {
  const t = useT();
  const { locale } = useLocale();
  const [openingApplicationId, setOpeningApplicationId] = useState<string | null>(
    null,
  );
  const [openError, setOpenError] = useState<string | null>(null);

  const { submitted, pending } = useMemo(() => {
    const applications = batch?.applications ?? [];

    return {
      submitted: applications.filter((app) => app.status === "submitted"),
      pending: applications.filter((app) => app.status !== "submitted"),
    };
  }, [batch?.applications]);

  if (!batch) {
    return (
      <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        {t.applications.batch.empty}
      </div>
    );
  }

  async function handleOpenForm(application: ApplicationItem) {
    if (openingApplicationId === application.id) {
      return;
    }

    setOpeningApplicationId(application.id);
    setOpenError(null);

    try {
      await prepareAndOpenUniversityForm({
        studentId,
        application,
      });
      await onApplicationsChange?.();
    } catch {
      setOpenError(t.applications.batch.openFormFailed);
    } finally {
      setOpeningApplicationId(null);
    }
  }

  return (
    <div className="min-w-0 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">
            {t.applications.batch.submissionPrefix}{batch.id.slice(0, 8)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(batch.createdAt))}
          </div>
        </div>
        <StatusBadge label={getBatchStatusLabel(batch.status, t)} status={batch.status} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <Counter label={t.applications.batch.counterTotal} value={batch.total} tone="slate" />
        <Counter label={t.applications.batch.counterSubmitted} value={batch.submitted} tone="emerald" />
        <Counter label={t.applications.batch.counterBlocked} value={batch.blocked} tone="amber" />
        <Counter label={t.applications.batch.counterFailed} value={batch.failed} tone="rose" />
      </div>

      {submitted.length > 0 || pending.length > 0 ? (
        <div className="mt-5 grid gap-5">
          {submitted.length > 0 ? (
            <ApplicationGroup
              title={t.applications.batch.groupSubmitted}
              count={submitted.length}
              tone="success"
            >
              {submitted.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  openingApplicationId={openingApplicationId}
                  onOpenForm={handleOpenForm}
                />
              ))}
            </ApplicationGroup>
          ) : null}

          {pending.length > 0 ? (
            <ApplicationGroup
              title={t.applications.batch.groupPending}
              count={pending.length}
              tone="pending"
            >
              {pending.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  openingApplicationId={openingApplicationId}
                  onOpenForm={handleOpenForm}
                />
              ))}
            </ApplicationGroup>
          ) : null}
        </div>
      ) : null}

      {openError ? <ErrorBadge message={openError} className="mt-4" /> : null}
    </div>
  );
}

function ApplicationGroup({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "success" | "pending";
  children: ReactNode;
}) {
  const titleClassName =
    tone === "success" ? "text-emerald-800" : "text-slate-700";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${titleClassName}`}>
          {title}
        </h3>
        <span className="text-[11px] font-medium tabular-nums text-slate-400">
          {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function ApplicationRow({
  application,
  openingApplicationId,
  onOpenForm,
}: {
  application: ApplicationItem;
  openingApplicationId: string | null;
  onOpenForm: (application: ApplicationItem) => void | Promise<void>;
}) {
  const t = useT();

  return (
    <div className="min-w-0 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-sm font-medium text-slate-900">
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
                  {t.applications.batch.goToLetter}
                </a>
              ) : null}
            </div>
          ) : null}
          {application.errorMessage ? (
            <ErrorBadge message={application.errorMessage} />
          ) : null}
          {application.formUrl && canOpenUniversityForm(application) ? (
            <button
              type="button"
              title={t.applications.batch.openFormTitle}
              disabled={openingApplicationId === application.id}
              onClick={() => onOpenForm(application)}
              className="mt-2 inline-flex h-8 cursor-pointer items-center rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-60"
            >
              {openingApplicationId === application.id
                ? t.applications.batch.opening
                : t.applications.batch.openForm}
            </button>
          ) : null}
        </div>
        <StatusBadge
          label={getApplicationStatusLabel(application.status, t)}
          status={application.status}
        />
      </div>

      {application.steps.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {sortStepsByPipeline(application.steps).map((step) => (
            <span
              key={step.id}
              className={`w-fit rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ${
                step.status === "failed"
                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : step.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : step.status === "processing"
                      ? "bg-sky-50 text-sky-700 ring-sky-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200/60"
              }`}
            >
              {getStepLabel(step.stepName, t)}: {getStepStatusLabel(step.status, t)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ErrorBadge({
  message,
  className = "mt-2",
}: {
  message: string;
  className?: string;
}) {
  const t = useT();
  const display = formatErrorMessage(message, t);

  return (
    <div className={`min-w-0 max-w-full ${className}`}>
      <span
        title={message}
        className="inline-block max-w-full break-all rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold leading-snug text-rose-700 ring-1 ring-rose-200"
      >
        {display}
      </span>
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
      className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${getStatusClassName(
        status,
      )}`}
    >
      {label}
    </span>
  );
}
