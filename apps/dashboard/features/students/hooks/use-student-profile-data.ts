"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createApplicationBatch,
  getApplicationBatches,
} from "@/features/applications/api/applications.api";
import { isActiveBatch } from "@/features/applications/lib/status";
import type { ApplicationBatch } from "@/features/applications/types/application.types";
import { getStudentDocuments } from "@/features/documents/api/documents.api";
import type { StudentDocument } from "@/features/documents/types/document.types";
import { useT } from "@/lib/i18n/context";
import { getStudentProfile } from "../api/students.api";
import type { ApplicationTarget, StudentProfile } from "../types/student.types";

export function useStudentProfileData(studentId: string) {
  const t = useT();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [batches, setBatches] = useState<ApplicationBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [highlightUniversityId, setHighlightUniversityId] = useState<string>();

  const loadDocuments = useCallback(async () => {
    setDocuments(await getStudentDocuments(studentId));
  }, [studentId]);

  const loadBatches = useCallback(async () => {
    setBatches(await getApplicationBatches(studentId));
  }, [studentId]);

  const loadProfile = useCallback(async () => {
    setStudent(await getStudentProfile(studentId));
  }, [studentId]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getStudentProfile(studentId),
      getStudentDocuments(studentId),
      getApplicationBatches(studentId),
    ])
      .then(([profile, studentDocuments, applicationBatches]) => {
        if (isMounted) {
          setStudent(profile);
          setDocuments(studentDocuments);
          setBatches(applicationBatches);
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(t.students.profilePage.loadFailed);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const latestBatch = batches[0];

  useEffect(() => {
    function syncHashHighlight() {
      const match = window.location.hash.match(/^#motivation-letter-(.+)$/);

      setHighlightUniversityId(match?.[1]);
    }

    syncHashHighlight();
    window.addEventListener("hashchange", syncHashHighlight);

    return () => window.removeEventListener("hashchange", syncHashHighlight);
  }, []);

  useEffect(() => {
    if (!latestBatch || !isActiveBatch(latestBatch.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadBatches().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [latestBatch, loadBatches]);

  const documentsByType = useMemo(() => {
    const groupedDocuments = new Map<string, StudentDocument[]>();

    for (const document of documents) {
      const documentsForType = groupedDocuments.get(document.type) ?? [];
      documentsForType.push(document);
      groupedDocuments.set(document.type, documentsForType);
    }

    for (const [type, documentsForType] of groupedDocuments) {
      documentsForType.sort(
        (left, right) =>
          (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
          new Date(left.uploadedAt).getTime() -
            new Date(right.uploadedAt).getTime(),
      );
      groupedDocuments.set(type, documentsForType);
    }

    return groupedDocuments;
  }, [documents]);

  const resolvedTargets = useMemo(
    () =>
      student?.applicationTargets.filter((target) =>
        Boolean(target.universityId),
      ) ?? [],
    [student?.applicationTargets],
  );

  const submittedUniversityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const batch of batches) {
      for (const application of batch.applications) {
        if (application.status === "submitted") {
          ids.add(application.universityId);
        }
      }
    }
    return ids;
  }, [batches]);

  const pendingTargets = useMemo(
    () =>
      resolvedTargets.filter(
        (target) =>
          target.universityId && !submittedUniversityIds.has(target.universityId),
      ),
    [resolvedTargets, submittedUniversityIds],
  );

  function handleTargetsChange(targets: ApplicationTarget[]) {
    setStudent((current) =>
      current ? { ...current, applicationTargets: targets } : current,
    );
  }

  async function handleCreateBatch() {
    if (resolvedTargets.length === 0) {
      setSubmitError(t.students.profilePage.noTargetError);
      return;
    }

    if (pendingTargets.length === 0) {
      setSubmitError(t.students.profilePage.allSubmittedError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createApplicationBatch(studentId);
      await Promise.all([loadBatches(), loadProfile()]);
    } catch {
      setSubmitError(t.students.profilePage.createBatchFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
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
    loadProfile,
    handleTargetsChange,
    handleCreateBatch,
  };
}
