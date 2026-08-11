"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { ApplicationTargetsPanel } from "@/features/applications/components/application-targets-panel";
import { MotivationLettersPanel } from "@/features/letters/components/motivation-letters-panel";
import { UniversitySelectPanel } from "@/features/universities/components/university-select-panel";
import type { StudentDocument } from "@/features/documents/types/document.types";
import type { ApplicationTarget, StudentProfile } from "../types/student.types";

type UniversitiesTabProps = {
  studentId: string;
  student: StudentProfile;
  documentsByType: Map<string, StudentDocument[]>;
  highlightUniversityId?: string;
  onTargetsChange: (targets: ApplicationTarget[]) => void;
};

export function UniversitiesTab({
  studentId,
  student,
  documentsByType,
  highlightUniversityId,
  onTargetsChange,
}: UniversitiesTabProps) {
  const t = useT();
  const [showManualLink, setShowManualLink] = useState(false);

  return (
    <div className="grid gap-8">
      <div>
        <UniversitySelectPanel
          studentId={studentId}
          targets={student.applicationTargets}
          documentsByType={documentsByType}
          onTargetsChange={onTargetsChange}
        />

        <button
          type="button"
          onClick={() => setShowManualLink((current) => !current)}
          className="mt-3 cursor-pointer text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
        >
          {showManualLink
            ? t.universities.selectPanel.backToSelect
            : t.universities.selectPanel.manualLinkToggle}
        </button>

        {showManualLink ? (
          <div className="mt-3">
            <ApplicationTargetsPanel
              studentId={studentId}
              targets={student.applicationTargets}
              onTargetsChange={onTargetsChange}
            />
          </div>
        ) : null}
      </div>

      <MotivationLettersPanel student={student} highlightUniversityId={highlightUniversityId} />
    </div>
  );
}
