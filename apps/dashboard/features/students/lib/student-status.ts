import {
  computeProfileReadiness,
  type ReadinessDocumentInput,
  type ReadinessProfileInput,
} from "./profile-readiness";
import type { StudentListBatchSummary } from "../types/student.types";

export type StudentStatusBucket = "needs_attention" | "ready" | "in_progress" | "submitted";

export function getStudentStatusClassName(status: StudentStatusBucket) {
  const classes: Record<StudentStatusBucket, string> = {
    needs_attention: "bg-amber-100 text-amber-800 ring-amber-200",
    ready: "bg-violet-100 text-violet-800 ring-violet-200",
    in_progress: "bg-sky-100 text-sky-800 ring-sky-200",
    submitted: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  };

  return classes[status];
}

/**
 * Buckets a student for the dashboard KPI tiles / filter tabs. A batch (once created) always
 * wins over profile/document state — it reflects what's actually happening with the university
 * forms, not just whether the paperwork looks complete.
 */
export function computeStudentStatus(
  profile: ReadinessProfileInput,
  documents: ReadinessDocumentInput[],
  applicationTargets: { universityId?: string }[],
  latestBatch?: StudentListBatchSummary,
): StudentStatusBucket {
  if (latestBatch) {
    if (latestBatch.blocked > 0) {
      return "needs_attention";
    }

    if (latestBatch.total > 0 && latestBatch.submitted >= latestBatch.total) {
      return "submitted";
    }

    return "in_progress";
  }

  const readiness = computeProfileReadiness(profile, documents);
  const hasUniversities = applicationTargets.some((target) => Boolean(target.universityId));

  return readiness.overallPercent === 100 && hasUniversities ? "ready" : "needs_attention";
}

/** Manual self-check — run with `pnpm exec node --experimental-strip-types student-status.selfcheck.ts` equivalent, or just read it. No test runner is wired up in this app for a single pure function. */
export function __selfCheckComputeStudentStatus() {
  const readyProfile: ReadinessProfileInput = {
    personal: {
      surname: "Petrov",
      givenName: "Ivan",
      email: "ivan@example.com",
      phone: "+1",
      nationality: "KZ",
      dateOfBirth: "2000-01-01",
      passportNo: "123",
      permanentAddress: "Street 1",
    },
    education: [{ level: "higher", institution: "MIT", periodStart: "2018", periodEnd: "2022" }],
    languages: [{ language: "en", score: "7.5" }],
  };
  const fullDocuments: ReadinessDocumentInput[] = [
    { type: "photo" },
    { type: "passport" },
    { type: "transcript" },
    { type: "financial" },
  ];
  const targets = [{ universityId: "uni-1" }];

  const asserts: [string, boolean][] = [
    [
      "complete profile + docs + targets, no batch => ready",
      computeStudentStatus(readyProfile, fullDocuments, targets, undefined) === "ready",
    ],
    [
      "no targets yet => needs_attention",
      computeStudentStatus(readyProfile, fullDocuments, [], undefined) === "needs_attention",
    ],
    [
      "batch with a blocked application => needs_attention regardless of profile state",
      computeStudentStatus(readyProfile, fullDocuments, targets, {
        id: "b1",
        status: "processing",
        total: 4,
        submitted: 1,
        blocked: 1,
        failed: 0,
      }) === "needs_attention",
    ],
    [
      "batch partially submitted, nothing blocked => in_progress",
      computeStudentStatus(readyProfile, fullDocuments, targets, {
        id: "b1",
        status: "processing",
        total: 4,
        submitted: 2,
        blocked: 0,
        failed: 0,
      }) === "in_progress",
    ],
    [
      "batch fully submitted => submitted",
      computeStudentStatus(readyProfile, fullDocuments, targets, {
        id: "b1",
        status: "completed",
        total: 4,
        submitted: 4,
        blocked: 0,
        failed: 0,
      }) === "submitted",
    ],
  ];

  for (const [label, passed] of asserts) {
    console.assert(passed, `computeStudentStatus: ${label}`);
  }

  return asserts.every(([, passed]) => passed);
}
