"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";

export type StudentActionItem = {
  studentId: string;
  name: string;
  reason: string;
  actionLabel: string;
  href: string;
};

export function StudentsNeedingAttention({ items }: { items: StudentActionItem[] }) {
  const t = useT();

  return (
    <section className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-950">
          {t.dashboard.needingAttention.title}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          {t.dashboard.needingAttention.empty}
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.studentId}
              className="flex items-center justify-between gap-4 border-b border-slate-50 px-6 py-4 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{item.name}</div>
                <div className="truncate text-sm text-slate-500">{item.reason}</div>
              </div>
              <Link
                href={item.href}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-xl px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                {item.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
