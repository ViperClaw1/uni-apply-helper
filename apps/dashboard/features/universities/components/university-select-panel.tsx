"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useDocumentTypeLabel } from "@/features/documents/constants/document-types";
import type { StudentDocument } from "@/features/documents/types/document.types";
import { setStudentApplicationTargets } from "@/features/students/api/students.api";
import type { ApplicationTarget } from "@/features/students/types/student.types";
import { getUniversities, getUniversity } from "../api/universities.api";
import type { UniversityDetail, UniversitySummary } from "../types/university.types";

type UniversitySelectPanelProps = {
  studentId: string;
  targets: ApplicationTarget[];
  documentsByType: Map<string, StudentDocument[]>;
  onTargetsChange: (targets: ApplicationTarget[]) => void;
};

export function UniversitySelectPanel({
  studentId,
  targets,
  documentsByType,
  onTargetsChange,
}: UniversitySelectPanelProps) {
  const t = useT();
  const s = t.universities.selectPanel;
  const documentTypeLabel = useDocumentTypeLabel();

  const [universities, setUniversities] = useState<UniversitySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailByUniversity, setDetailByUniversity] = useState<Map<string, UniversityDetail>>(
    new Map(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getUniversities()
      .then((data) => {
        if (isMounted) {
          setUniversities(data);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadError(s.loadFailed);
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
  }, []);

  const selectedIds = useMemo(
    () =>
      new Set(
        targets.map((target) => target.universityId).filter((id): id is string => Boolean(id)),
      ),
    [targets],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return universities;
    }

    return universities.filter(
      (university) =>
        university.displayName.toLowerCase().includes(query) ||
        university.aliases.some((alias) => alias.toLowerCase().includes(query)),
    );
  }, [universities, search]);

  async function toggleUniversity(university: UniversitySummary) {
    if (isSaving) {
      return;
    }

    const nextSelectedIds = new Set(selectedIds);

    if (nextSelectedIds.has(university.id)) {
      nextSelectedIds.delete(university.id);
    } else {
      nextSelectedIds.add(university.id);
    }

    const nextFormUrls = universities
      .filter((item) => nextSelectedIds.has(item.id))
      .map((item) => item.formUrl);

    setIsSaving(true);
    setSaveError(null);

    try {
      const profile = await setStudentApplicationTargets(studentId, nextFormUrls);
      onTargetsChange(profile.applicationTargets);
    } catch {
      setSaveError(s.saveFailed);
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleExpand(universityId: string) {
    if (expandedId === universityId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(universityId);

    if (detailByUniversity.has(universityId)) {
      return;
    }

    try {
      const detail = await getUniversity(universityId);
      setDetailByUniversity((current) => new Map(current).set(universityId, detail));
    } catch {
      // Requirements just won't render for this one — selection above still works.
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{s.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{s.description}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
          {selectedIds.size}
          {s.selectedCountSuffix}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={s.searchPlaceholder}
        className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
      />

      {saveError ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
          {saveError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-400">{t.common.loading}</p>
      ) : loadError ? (
        <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{s.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {filtered.map((university) => {
            const isSelected = selectedIds.has(university.id);
            const isExpanded = expandedId === university.id;
            const detail = detailByUniversity.get(university.id);

            return (
              <li key={university.id} className="py-2">
                <div className="flex items-center gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isSaving}
                      onChange={() => {
                        toggleUniversity(university).catch(() => undefined);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-900">
                      {university.displayName}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      toggleExpand(university.id).catch(() => undefined);
                    }}
                    className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="ml-7 mt-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div className="font-semibold text-slate-600">{s.requirementsTitle}</div>
                    {detail ? (
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {detail.requiredDocuments.map((type) => {
                          const present = (documentsByType.get(type)?.length ?? 0) > 0;

                          return (
                            <li
                              key={type}
                              className={present ? "text-emerald-700" : "text-amber-700"}
                            >
                              {present ? "✓" : "⚠"} {documentTypeLabel(type)}
                            </li>
                          );
                        })}
                        {detail.requiresEssay ? (
                          <li className="text-slate-600">• {s.essayRequired}</li>
                        ) : null}
                      </ul>
                    ) : (
                      <div className="mt-1.5 text-slate-400">{t.common.loading}</div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
