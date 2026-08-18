"use client";

import Link from "next/link";
import { useRef } from "react";
import { useT } from "@/lib/i18n/context";
import { gsap, useGSAP } from "@/lib/gsap";

export type DashboardStatCounts = {
  students: number;
  needs_attention: number;
  ready: number;
  in_progress: number;
  submitted: number;
};

// Students tab lives at /students and reads the same filter values used for its own KPI tiles
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
  const root = useRef<HTMLDivElement>(null);

  const tiles: { key: keyof DashboardStatCounts; label: string }[] = [
    { key: "students", label: t.dashboard.stats.students },
    { key: "needs_attention", label: t.dashboard.stats.needsAttention },
    { key: "ready", label: t.dashboard.stats.ready },
    { key: "in_progress", label: t.dashboard.stats.inProgress },
    { key: "submitted", label: t.dashboard.stats.submitted },
  ];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-kpi-tile]");
        gsap.from(items, {
          y: 12,
          opacity: 0,
          filter: "blur(4px)",
          duration: 0.4,
          stagger: 0.08,
          ease: "power2.out",
        });
        items.forEach((tile) => {
          const num = tile.querySelector<HTMLElement>("[data-kpi-value]");
          if (!num) return;
          const end = Number(num.dataset.value);
          const proxy = { val: 0 };
          num.textContent = "0";
          gsap.to(proxy, {
            val: end,
            duration: 0.7,
            ease: "power2.out",
            onUpdate: () => {
              num.textContent = String(Math.round(proxy.val));
            },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          data-kpi-tile
          href={`/students?filter=${FILTERS[tile.key]}`}
          className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 transition-[color,background-color,transform] duration-150 ease-out hover:bg-slate-50 active:scale-[0.96]"
        >
          <div
            data-kpi-value
            data-value={counts[tile.key]}
            className="text-2xl font-semibold tabular-nums text-slate-950"
          >
            {counts[tile.key]}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">{tile.label}</div>
        </Link>
      ))}
    </div>
  );
}
