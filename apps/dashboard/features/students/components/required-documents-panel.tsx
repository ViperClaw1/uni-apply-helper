"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { getUniversity } from "@/features/universities/api/universities.api";
import { useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import type { StudentDocument } from "@/features/documents/types/document.types";
import type { ApplicationTarget } from "../types/student.types";

type RequiredDocumentsPanelProps = {
  targets: ApplicationTarget[];
  documentsByType: Map<string, StudentDocument[]>;
};

export function RequiredDocumentsPanel({ targets, documentsByType }: RequiredDocumentsPanelProps) {
  const t = useT();
  const documentTypeLabel = useDocumentTypeLabel();
  const universityIds = targets
    .map((target) => target.universityId)
    .filter((id): id is string => Boolean(id));
  const universityIdsKey = universityIds.join(",");
  const [requiredTypes, setRequiredTypes] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    Promise.all(universityIds.map((id) => getUniversity(id)))
      .then((universities) => {
        if (!isMounted) {
          return;
        }

        const union = new Set<string>();
        for (const university of universities) {
          for (const type of university.requiredDocuments) {
            union.add(type);
          }
        }
        setRequiredTypes([...union]);
      })
      .catch(() => {
        if (isMounted) {
          setRequiredTypes([]);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityIdsKey]);

  if (requiredTypes.length === 0) {
    return null;
  }

  const panel = t.documents.requiredDocumentsPanel;

  return (
    <div className="mb-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <h3 className="text-sm font-semibold text-slate-950">{panel.title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {requiredTypes.map((type) => {
          const present = (documentsByType.get(type)?.length ?? 0) > 0;

          return (
            <li key={type} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{documentTypeLabel(type)}</span>
              <span
                className={`font-medium ${present ? "text-emerald-700" : "text-amber-700"}`}
              >
                {present ? `✓ ${panel.present}` : `⚠ ${panel.missing}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
