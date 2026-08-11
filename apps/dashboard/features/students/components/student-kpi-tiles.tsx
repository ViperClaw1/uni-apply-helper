"use client";

import { useT } from "@/lib/i18n/context";
import type { StudentStatusBucket } from "../lib/student-status";

export type StudentStatusFilter = "all" | StudentStatusBucket;

type StudentKpiTilesProps = {
  counts: Record<StudentStatusFilter, number>;
  active: StudentStatusFilter;
  onChange: (filter: StudentStatusFilter) => void;
};

export function StudentKpiTiles({ counts, active, onChange }: StudentKpiTilesProps) {
  const t = useT();

  const tiles: { key: StudentStatusFilter; label: string }[] = [
    { key: "all", label: t.students.list.kpiAll },
    { key: "needs_attention", label: t.students.list.kpiNeedsAttention },
    { key: "ready", label: t.students.list.kpiReady },
    { key: "in_progress", label: t.students.list.kpiInProgress },
    { key: "submitted", label: t.students.list.kpiSubmitted },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map((tile) => {
        const isActive = active === tile.key;

        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onChange(tile.key)}
            className={`cursor-pointer rounded-2xl px-4 py-3 text-left ring-1 transition-colors ${
              isActive
                ? "bg-slate-950 text-white ring-slate-950"
                : "bg-white text-slate-950 ring-black/5 hover:bg-slate-50"
            }`}
          >
            <div className="text-2xl font-semibold tabular-nums">{counts[tile.key]}</div>
            <div
              className={`mt-1 text-xs font-medium ${isActive ? "text-slate-300" : "text-slate-500"}`}
            >
              {tile.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
