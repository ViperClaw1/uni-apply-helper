"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ComingSoon } from "@/components/agency-shell";
import { useT } from "@/lib/i18n/context";
import { toTitleCase } from "@/lib/format";
import { ApplicationTargetsPanel } from "@/features/applications/components/application-targets-panel";
import { BatchPanel } from "@/features/applications/components/batch-panel";
import { MotivationLettersPanel } from "@/features/letters/components/motivation-letters-panel";
import {
  getApplicationStatusLabel,
  getStatusClassName,
} from "@/features/applications/lib/status";
import { DEFAULT_DOCUMENT_TYPES, useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import { DocumentUploader } from "@/features/documents/components/document-uploader";
import { useStudentProfileData } from "../hooks/use-student-profile-data";
import { computeProfileReadiness, type CategoryReadiness } from "../lib/profile-readiness";
import { buildApplicationTimeline, type TimelineEventKind } from "../lib/application-timeline";
import {
  toEducationInput,
  toEmergencyContactInput,
  toFamilyInput,
  toGuarantorInput,
  toPersonalInput,
} from "./profile-wizard/profile-wizard";
import { PersonalStep } from "./profile-wizard/personal-step";
import { EducationStep } from "./profile-wizard/education-step";
import { GuarantorStep } from "./profile-wizard/guarantor-step";
import { EmergencyContactStep } from "./profile-wizard/emergency-contact-step";
import { FamilyStep } from "./profile-wizard/family-step";

type TabKey = "review" | "info" | "documents" | "applications" | "notes" | "history";

export function StudentDetailPage() {
  const t = useT();
  const documentTypeLabel = useDocumentTypeLabel();
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [activeTab, setActiveTab] = useState<TabKey>("review");

  const {
    student,
    setStudent,
    documents,
    batches,
    isLoading,
    isSubmitting,
    error,
    submitError,
    highlightUniversityId,
    latestBatch,
    documentsByType,
    resolvedTargets,
    pendingTargets,
    loadDocuments,
    loadBatches,
    handleTargetsChange,
    handleCreateBatch,
  } = useStudentProfileData(studentId);

  if (isLoading) {
    return <PageShell title={t.common.loading} />;
  }

  if (error || !student) {
    return (
      <PageShell
        title={t.common.error}
        description={error ?? t.students.profilePage.studentNotFound}
      />
    );
  }

  const studentName = formatStudentName(student.personal, t.common.nameNotSet);
  const readiness = computeProfileReadiness(student, documents);
  const allApplications = batches.flatMap((batch) => batch.applications);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.05)] ring-1 ring-black/5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {studentName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
              <span>{student.personal.email || t.common.emailNotProvided}</span>
              {student.personal.phone ? (
                <>
                  <span>•</span>
                  <span>{student.personal.phone}</span>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${readiness.overallPercent}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-medium text-slate-600">
                {readiness.overallPercent}%
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={`/students/${studentId}/edit`}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            >
              <EditIcon />
              {t.students.detail.header.editButton}
            </Link>
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            >
              <UploadIcon />
              {t.students.detail.header.uploadButton}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("applications")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <ApplyIcon />
              {t.students.detail.header.applyButton}
            </button>
          </div>
        </div>
      </section>

      <nav className="mt-6 flex gap-1 border-b border-slate-200">
        {(
          [
            ["review", t.students.detail.tabs.review],
            ["info", t.students.detail.tabs.info],
            ["documents", t.students.detail.tabs.documents],
            ["applications", t.students.detail.tabs.applications],
            ["notes", t.students.detail.tabs.notes],
            ["history", t.students.detail.tabs.history],
          ] as [TabKey, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-slate-950"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {activeTab === "review" ? (
          <ReviewTab
            readiness={readiness.categories}
            student={student}
            allApplications={allApplications}
            onJumpToTab={setActiveTab}
          />
        ) : null}

        {activeTab === "info" ? (
          <InfoTab studentId={studentId} student={student} onUpdated={setStudent} />
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {DEFAULT_DOCUMENT_TYPES.map((documentType) => (
              <DocumentUploader
                key={documentType.key}
                studentId={studentId}
                type={documentType.key}
                label={documentTypeLabel(documentType.key)}
                accept={documentType.accept}
                parse={documentType.parse}
                multiple={documentType.multiple}
                existingDocuments={documentsByType.get(documentType.key)}
                onUploaded={loadDocuments}
              />
            ))}
          </div>
        ) : null}

        {activeTab === "applications" ? (
          <div className="grid gap-8">
            <ApplicationTargetsPanel
              studentId={studentId}
              targets={student.applicationTargets}
              onTargetsChange={handleTargetsChange}
            />

            <MotivationLettersPanel
              student={student}
              highlightUniversityId={highlightUniversityId}
            />

            <div>
              <BatchPanel
                batch={latestBatch}
                studentId={studentId}
                onApplicationsChange={loadBatches}
              />

              {submitError ? (
                <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
                  {submitError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleCreateBatch}
                disabled={isSubmitting || pendingTargets.length === 0}
                className="mt-4 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60"
              >
                {isSubmitting
                  ? t.students.profilePage.submitting
                  : resolvedTargets.length === 0
                    ? t.students.profilePage.submitNoTargets
                    : pendingTargets.length === 0
                      ? t.students.profilePage.submitAllDone
                      : `${t.students.profilePage.submitButtonPrefix}${pendingTargets.length}${t.students.profilePage.submitButtonSuffix}`}
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "notes" ? <ComingSoon /> : null}

        {activeTab === "history" ? <HistoryTab batches={batches} /> : null}
      </div>
    </main>
  );
}

function ReviewTab({
  readiness,
  student,
  allApplications,
  onJumpToTab,
}: {
  readiness: CategoryReadiness[];
  student: import("../types/student.types").StudentProfile;
  allApplications: import("@/features/applications/types/application.types").ApplicationItem[];
  onJumpToTab: (tab: TabKey) => void;
}) {
  const t = useT();
  const categoryLabel = (category: CategoryReadiness["category"]) =>
    t.students.detail.readiness.categories[category];
  const statusLabel = (item: CategoryReadiness) =>
    item.status === "done"
      ? t.students.detail.readiness.status.done
      : item.status === "not_uploaded"
        ? t.students.detail.readiness.status.notUploaded
        : `${item.missingCount}${t.students.detail.readiness.status.missingSuffix}`;
  const statusColor = (status: CategoryReadiness["status"]) =>
    status === "done"
      ? "text-emerald-700"
      : status === "not_uploaded"
        ? "text-rose-700"
        : "text-amber-700";
  const attentionItems = readiness.filter((item) => item.status !== "done");
  const jumpTargetForCategory = (category: CategoryReadiness["category"]): TabKey =>
    category === "documents" ? "documents" : "info";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
          <h2 className="text-base font-semibold text-slate-950">
            {t.students.detail.readiness.title}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {readiness.map((item) => (
              <li key={item.category} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{categoryLabel(item.category)}</span>
                <span className={`font-medium ${statusColor(item.status)}`}>
                  {statusLabel(item)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
          <h2 className="text-base font-semibold text-slate-950">
            {t.students.detail.readiness.attentionTitle}
          </h2>
          {attentionItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              {t.students.detail.readiness.attentionEmpty}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {attentionItems.map((item) => (
                <li
                  key={item.category}
                  className="flex items-center justify-between gap-3 rounded-xl bg-amber-50/60 px-3 py-2 text-sm ring-1 ring-amber-100"
                >
                  <span className="text-slate-700">{categoryLabel(item.category)}</span>
                  <button
                    type="button"
                    onClick={() => onJumpToTab(jumpTargetForCategory(item.category))}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-50"
                  >
                    {t.students.detail.readiness.addButton}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        <h2 className="text-base font-semibold text-slate-950">
          {t.students.detail.applicationsTable.title}
        </h2>

        {student.applicationTargets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            {t.students.profilePage.noneSelected}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-medium text-slate-400">
                  <th className="pb-2 pr-4">{t.students.detail.applicationsTable.university}</th>
                  <th className="pb-2 pr-4">{t.students.detail.applicationsTable.program}</th>
                  <th className="pb-2 pr-4">{t.students.detail.applicationsTable.status}</th>
                  <th className="pb-2">{t.students.detail.applicationsTable.actions}</th>
                </tr>
              </thead>
              <tbody>
                {student.applicationTargets.map((target) => {
                  const matched = allApplications.find(
                    (application) => application.universityId === target.universityId,
                  );
                  const program =
                    [target.degree, target.major].filter(Boolean).join(" · ") || "—";

                  return (
                    <tr key={target.id ?? target.universityRaw} className="border-t border-slate-100">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                        {target.universityRaw}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{program}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${
                            matched
                              ? getStatusClassName(matched.status)
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {matched
                            ? getApplicationStatusLabel(matched.status, t)
                            : t.students.detail.applicationsTable.notStarted}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => onJumpToTab("applications")}
                          className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                        >
                          {t.students.detail.applicationsTable.continueLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTab({
  studentId,
  student,
  onUpdated,
}: {
  studentId: string;
  student: import("../types/student.types").StudentProfile;
  onUpdated: (profile: import("../types/student.types").StudentProfile) => void;
}) {
  const t = useT();
  const labels = t.profileWizard.stepLabels;

  return (
    <div className="flex flex-col gap-6">
      <InfoSection title={labels[0]}>
        <PersonalStep initial={toPersonalInput(student)} studentId={studentId} onNext={onUpdated} />
      </InfoSection>
      <InfoSection title={labels[1]}>
        <EducationStep initial={toEducationInput(student)} studentId={studentId} onNext={onUpdated} />
      </InfoSection>
      <InfoSection title={labels[2]}>
        <GuarantorStep initial={toGuarantorInput(student)} studentId={studentId} onNext={onUpdated} />
      </InfoSection>
      <InfoSection title={labels[3]}>
        <EmergencyContactStep
          initial={toEmergencyContactInput(student)}
          studentId={studentId}
          onNext={onUpdated}
        />
      </InfoSection>
      <InfoSection title={labels[4]}>
        <FamilyStep initial={toFamilyInput(student)} studentId={studentId} onNext={onUpdated} />
      </InfoSection>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h2 className="mb-4 text-base font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function HistoryTab({
  batches,
}: {
  batches: import("@/features/applications/types/application.types").ApplicationBatch[];
}) {
  const t = useT();
  const events = buildApplicationTimeline(batches, t);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        {t.students.detail.history.empty}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5"
        >
          <span className="mt-0.5 shrink-0 text-slate-400">
            <TimelineIcon kind={event.kind} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800">{event.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {new Date(event.at).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimelineIcon({ kind }: { kind: TimelineEventKind }) {
  if (kind === "step_failed") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "application_submitted" || kind === "step_completed") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

function formatStudentName(
  student: { givenName?: string; surname?: string },
  fallback: string,
) {
  const name = [student.givenName, student.surname]
    .filter((part): part is string => Boolean(part))
    .map(toTitleCase)
    .join(" ");

  return name || fallback;
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ApplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m12 3 9 5-9 5-9-5 9-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PageShell({ title, description }: { title: string; description?: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-8">
      <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
      </div>
    </main>
  );
}
