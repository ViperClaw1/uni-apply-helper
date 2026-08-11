"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { toTitleCase } from "@/lib/format";
import { getStudents } from "@/features/students/api/students.api";
import { computeStudentStatus } from "@/features/students/lib/student-status";
import { REQUIRED_DOCUMENT_TYPES } from "@/features/students/lib/profile-readiness";
import { useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import type { StudentListItem } from "@/features/students/types/student.types";
import { getUniversitySessions } from "@/features/universities/api/universities.api";
import type { UniversitySession } from "@/features/universities/types/session.types";
import { DashboardStats, type DashboardStatCounts } from "./dashboard-stats";
import { StudentsNeedingAttention, type StudentActionItem } from "./students-needing-attention";
import { UniversitySessionsPanel } from "./university-sessions-panel";

export function AgencyDashboard() {
  const t = useT();
  const documentTypeLabel = useDocumentTypeLabel();
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [sessions, setSessions] = useState<UniversitySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    getUniversitySessions()
      .then(setSessions)
      .catch(() => setError((current) => current ?? t.dashboard.sessions.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getStudents(), getUniversitySessions()])
      .then(([studentsData, sessionsData]) => {
        if (isMounted) {
          setStudents(studentsData);
          setSessions(sessionsData);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(t.dashboard.loadFailed);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statuses = useMemo(
    () =>
      (students ?? []).map((student) => ({
        student,
        status: computeStudentStatus(
          student,
          student.documents,
          student.applicationTargets,
          student.latestBatch,
        ),
      })),
    [students],
  );

  const counts = useMemo<DashboardStatCounts>(
    () => ({
      students: statuses.length,
      needs_attention: statuses.filter((entry) => entry.status === "needs_attention").length,
      ready: statuses.filter((entry) => entry.status === "ready").length,
      in_progress: statuses.filter((entry) => entry.status === "in_progress").length,
      submitted: statuses.filter((entry) => entry.status === "submitted").length,
    }),
    [statuses],
  );

  const actionItems = useMemo<StudentActionItem[]>(() => {
    const items: StudentActionItem[] = [];

    for (const { student, status } of statuses) {
      const name = formatStudentName(student.personal, t.common.nameNotSet);

      if (status === "needs_attention") {
        const presentTypes = new Set(student.documents.map((document) => document.type));
        const missingType = REQUIRED_DOCUMENT_TYPES.find((type) => !presentTypes.has(type));
        const hasUniversities = student.applicationTargets.some((target) =>
          Boolean(target.universityId),
        );
        const reason = missingType
          ? `${t.dashboard.needingAttention.missingDocumentPrefix}${documentTypeLabel(missingType)}`
          : !hasUniversities
            ? t.dashboard.needingAttention.noUniversities
            : t.dashboard.needingAttention.profileIncomplete;

        items.push({
          studentId: student.id,
          name,
          reason,
          actionLabel: t.dashboard.needingAttention.openStudent,
          href: `/students/${student.id}`,
        });
      } else if (status === "ready") {
        const universitiesCount = student.applicationTargets.filter((target) =>
          Boolean(target.universityId),
        ).length;

        items.push({
          studentId: student.id,
          name,
          reason: `${universitiesCount}${t.dashboard.needingAttention.readyToStartSuffix}`,
          actionLabel: t.dashboard.needingAttention.startApplications,
          href: `/students/${student.id}`,
        });
      }
    }

    return items;
  }, [statuses, t, documentTypeLabel]);

  if (!students || !sessions) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <StateCard title={error ?? t.dashboard.loading} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
        {t.dashboard.title}
      </h1>

      {error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}

      <DashboardStats counts={counts} />
      <StudentsNeedingAttention items={actionItems} />
      <UniversitySessionsPanel sessions={sessions} onRenewed={loadSessions} />
    </div>
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

function StateCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
    </div>
  );
}
