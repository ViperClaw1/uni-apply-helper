import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export function getBatchStatusLabel(status: string, t: Dictionary) {
  const labels: Record<string, string> = t.applications.status.batch;

  return labels[status] ?? status;
}

export function getApplicationStatusLabel(status: string, t: Dictionary) {
  const labels: Record<string, string> = t.applications.status.application;

  return labels[status] ?? status;
}

export function getStatusClassName(status: string) {
  const classes: Record<string, string> = {
    blocked: "bg-amber-100 text-amber-800 ring-amber-200",
    completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    failed: "bg-rose-100 text-rose-800 ring-rose-200",
    processing: "bg-sky-100 text-sky-800 ring-sky-200",
    queued: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    ready_for_submission: "bg-violet-100 text-violet-800 ring-violet-200",
    submitted: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  };

  return classes[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

export function isActiveBatch(status: string) {
  return status === "queued" || status === "processing";
}
