"use client";

import { useT } from "@/lib/i18n/context";
import type { ApplicationBatch } from "@/features/applications/types/application.types";
import type { CategoryReadiness } from "../lib/profile-readiness";

export type OverviewTabTarget = "profile" | "documents" | "universities" | "applications";

type OverviewTabProps = {
  readiness: { categories: CategoryReadiness[]; overallPercent: number };
  documentsPresent: number;
  documentsRequired: number;
  universitiesCount: number;
  latestBatch?: ApplicationBatch;
  onJumpToTab: (tab: OverviewTabTarget) => void;
};

export function OverviewTab({
  readiness,
  documentsPresent,
  documentsRequired,
  universitiesCount,
  latestBatch,
  onJumpToTab,
}: OverviewTabProps) {
  const t = useT();
  const o = t.students.detail.overview;

  const applications = latestBatch?.applications ?? [];
  const readyCount = applications.filter((app) => app.status === "ready_for_submission").length;
  const blockedCount = applications.filter((app) => app.status === "blocked").length;
  const submittedCount = applications.filter((app) => app.status === "submitted").length;

  const applicationsSummary = !latestBatch
    ? o.applicationsNotStarted
    : [
        readyCount > 0 ? `${readyCount}${o.applicationsReadySuffix}` : null,
        blockedCount > 0 ? `${blockedCount}${o.applicationsBlockedSuffix}` : null,
        submittedCount > 0 ? `${submittedCount}${o.applicationsSubmittedSuffix}` : null,
      ]
        .filter(Boolean)
        .join(o.applicationsSeparator) || o.applicationsNotStarted;

  const nextAction = computeNextAction({
    readiness,
    universitiesCount,
    latestBatch,
    readyCount,
    o,
    onJumpToTab,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={o.profileLabel}>
          <div className="flex items-center gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${readiness.overallPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-semibold text-slate-900">
              {readiness.overallPercent}%
            </span>
          </div>
        </StatCard>

        <StatCard label={o.documentsLabel}>
          <span className="text-lg font-semibold text-slate-950">
            {o.documentsValuePrefix}
            {documentsPresent}
            {o.documentsValueSeparator}
            {documentsRequired}
            {o.documentsValueSuffix}
          </span>
        </StatCard>

        <StatCard label={o.universitiesLabel}>
          <span className="text-lg font-semibold text-slate-950">
            {universitiesCount}
            {o.universitiesValueSuffix}
          </span>
        </StatCard>

        <StatCard label={o.applicationsLabel}>
          <span className="text-sm font-semibold text-slate-950">{applicationsSummary}</span>
        </StatCard>
      </div>

      {nextAction ? (
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
          <h2 className="text-base font-semibold text-slate-950">{o.nextActionTitle}</h2>
          <p className="mt-2 text-sm text-slate-600">{nextAction.message}</p>
          {nextAction.ctaLabel ? (
            <button
              type="button"
              onClick={nextAction.onClick}
              className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {nextAction.ctaLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function computeNextAction({
  readiness,
  universitiesCount,
  latestBatch,
  readyCount,
  o,
  onJumpToTab,
}: {
  readiness: OverviewTabProps["readiness"];
  universitiesCount: number;
  latestBatch?: ApplicationBatch;
  readyCount: number;
  o: ReturnType<typeof useT>["students"]["detail"]["overview"];
  onJumpToTab: (tab: OverviewTabTarget) => void;
}): { message: string; ctaLabel?: string; onClick?: () => void } {
  const isMissing = (category: CategoryReadiness["category"]) =>
    readiness.categories.find((item) => item.category === category)?.status !== "done";

  if (isMissing("personal")) {
    return {
      message: o.nextActionMissingPersonal,
      ctaLabel: o.ctaCompleteProfile,
      onClick: () => onJumpToTab("profile"),
    };
  }

  if (isMissing("education")) {
    return {
      message: o.nextActionMissingEducation,
      ctaLabel: o.ctaCompleteProfile,
      onClick: () => onJumpToTab("profile"),
    };
  }

  if (isMissing("language")) {
    return {
      message: o.nextActionMissingLanguage,
      ctaLabel: o.ctaCompleteProfile,
      onClick: () => onJumpToTab("profile"),
    };
  }

  if (isMissing("documents")) {
    return {
      message: o.nextActionMissingDocuments,
      ctaLabel: o.ctaUploadDocument,
      onClick: () => onJumpToTab("documents"),
    };
  }

  if (universitiesCount === 0) {
    return {
      message: o.nextActionNoUniversities,
      ctaLabel: o.ctaSelectUniversities,
      onClick: () => onJumpToTab("universities"),
    };
  }

  if (latestBatch) {
    const firstBlocked = latestBatch.applications.find((app) => app.status === "blocked");

    if (firstBlocked) {
      const university = firstBlocked.universityDisplayName ?? firstBlocked.universityId;
      return {
        message: firstBlocked.blockedReason
          ? `${university}: ${firstBlocked.blockedReason}`
          : o.nextActionMissingDocuments,
        ctaLabel: o.ctaFixNow,
        onClick: () => onJumpToTab("applications"),
      };
    }

    if (readyCount > 0) {
      return {
        message: `${readyCount}${o.nextActionReadyForReviewSuffix}`,
        ctaLabel: o.ctaGoToApplications,
        onClick: () => onJumpToTab("applications"),
      };
    }

    return { message: o.nextActionAllDone };
  }

  return {
    message: o.nextActionReadyToStart,
    ctaLabel: o.ctaGoToApplications,
    onClick: () => onJumpToTab("applications"),
  };
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
