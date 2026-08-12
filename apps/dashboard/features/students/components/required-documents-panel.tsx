"use client";

import { useT } from "@/lib/i18n/context";
import { Skeleton } from "@/components/skeleton";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { getUniversity } from "@/features/universities/api/universities.api";
import { useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import type { StudentDocument } from "@/features/documents/types/document.types";
import type { ApplicationTarget } from "../types/student.types";

type RequiredDocumentsPanelProps = {
  targets: ApplicationTarget[];
  documentsByType: Map<string, StudentDocument[]>;
};

async function fetchRequiredTypes(universityIds: string[]): Promise<string[]> {
  if (universityIds.length === 0) {
    return [];
  }

  const universities = await Promise.all(universityIds.map((id) => getUniversity(id)));
  const union = new Set<string>();

  for (const university of universities) {
    for (const type of university.requiredDocuments) {
      union.add(type);
    }
  }

  return [...union];
}

export function RequiredDocumentsPanel({ targets, documentsByType }: RequiredDocumentsPanelProps) {
  const t = useT();
  const documentTypeLabel = useDocumentTypeLabel();
  const universityIds = targets
    .map((target) => target.universityId)
    .filter((id): id is string => Boolean(id));
  const universityIdsKey = universityIds.join(",");

  const { data, isLoading } = useCachedFetch(`required-documents:${universityIdsKey}`, () =>
    fetchRequiredTypes(universityIds),
  );
  const requiredTypes = data ?? [];
  const showSkeleton = isLoading && universityIds.length > 0;

  if (showSkeleton) {
    return (
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

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
