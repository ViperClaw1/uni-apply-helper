"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { toTitleCase } from "@/lib/format";
import { ApplicationsReadinessPreview } from "@/features/applications/components/applications-readiness-preview";
import { BatchPanel } from "@/features/applications/components/batch-panel";
import { DEFAULT_DOCUMENT_TYPES, useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import { DocumentUploader } from "@/features/documents/components/document-uploader";
import { useStudentProfileData } from "../hooks/use-student-profile-data";
import { computeProfileReadiness, REQUIRED_DOCUMENT_TYPES } from "../lib/profile-readiness";
import { OverviewTab } from "./overview-tab";
import { RequiredDocumentsPanel } from "./required-documents-panel";
import { UniversitiesTab } from "./universities-tab";
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

type TabKey = "overview" | "profile" | "documents" | "universities" | "applications";

export function StudentDetailPage() {
  const t = useT();
  const documentTypeLabel = useDocumentTypeLabel();
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [readyCount, setReadyCount] = useState<number | null>(null);

  const {
    student,
    setStudent,
    documents,
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
  const documentsPresentTypes = new Set(documents.map((document) => document.type));
  const documentsPresent = REQUIRED_DOCUMENT_TYPES.filter((type) =>
    documentsPresentTypes.has(type),
  ).length;

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
              href="/dashboard"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            >
              <BackIcon />
              {t.students.profilePage.backToStudents}
            </Link>
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
            ["overview", t.students.detail.tabs.overview],
            ["profile", t.students.detail.tabs.profile],
            ["documents", t.students.detail.tabs.documents],
            ["universities", t.students.detail.tabs.universities],
            ["applications", t.students.detail.tabs.applications],
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
        {activeTab === "overview" ? (
          <OverviewTab
            readiness={readiness}
            documentsPresent={documentsPresent}
            documentsRequired={REQUIRED_DOCUMENT_TYPES.length}
            universitiesCount={resolvedTargets.length}
            latestBatch={latestBatch}
            onJumpToTab={setActiveTab}
          />
        ) : null}

        {activeTab === "profile" ? (
          <ProfileTab studentId={studentId} student={student} onUpdated={setStudent} />
        ) : null}

        {activeTab === "documents" ? (
          <div>
            <RequiredDocumentsPanel
              targets={resolvedTargets}
              documentsByType={documentsByType}
            />

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
          </div>
        ) : null}

        {activeTab === "universities" ? (
          <UniversitiesTab
            studentId={studentId}
            student={student}
            documentsByType={documentsByType}
            highlightUniversityId={highlightUniversityId}
            onTargetsChange={handleTargetsChange}
          />
        ) : null}

        {activeTab === "applications" ? (
          <div>
            {resolvedTargets.length > 0 ? (
              <ApplicationsReadinessPreview
                studentId={studentId}
                refreshKey={`${resolvedTargets.map((target) => target.universityId).join(",")}|${latestBatch?.id ?? ""}`}
                onReadyCountChange={setReadyCount}
              />
            ) : null}

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
                    : `${t.students.profilePage.submitButtonPrefix}${readyCount ?? pendingTargets.length}${t.students.profilePage.submitButtonSuffix}`}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ProfileTab({
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
    <div className="flex flex-col gap-4">
      <InfoSection title={labels[0]} defaultOpen>
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

function InfoSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-base font-semibold text-slate-950">
        {title}
        <ChevronIcon className="text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 p-6">{children}</div>
    </details>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5m0 0 6-6m-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
