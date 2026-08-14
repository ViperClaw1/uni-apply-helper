"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";

export type DashboardStatCounts = {
  students: number;
  needs_attention: number;
  ready: number;
  in_progress: number;
  submitted: number;
};

// Students tab lives at /dashboard and reads the same filter values used for its own KPI tiles
// ("all" | StudentStatusBucket) — "students" here maps to the unfiltered "all" view.
const FILTERS: Record<keyof DashboardStatCounts, string> = {
  students: "all",
  needs_attention: "needs_attention",
  ready: "ready",
  in_progress: "in_progress",
  submitted: "submitted",
};

export function DashboardStats({ counts }: { counts: DashboardStatCounts }) {
  const t = useT();

  const tiles: { key: keyof DashboardStatCounts; label: string }[] = [
    { key: "students", label: t.dashboard.stats.students },
    { key: "needs_attention", label: t.dashboard.stats.needsAttention },
    { key: "ready", label: t.dashboard.stats.ready },
    { key: "in_progress", label: t.dashboard.stats.inProgress },
    { key: "submitted", label: t.dashboard.stats.submitted },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          href={`/dashboard?filter=${FILTERS[tile.key]}`}
          className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 transition-colors hover:bg-slate-50"
        >
          <div className="text-2xl font-semibold tabular-nums text-slate-950">
            {counts[tile.key]}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">{tile.label}</div>
        </Link>
      ))}
    </div>
  );
}
