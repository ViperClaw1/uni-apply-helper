"use client";

import { useMemo, useState } from "react";
import { setStudentApplicationTargets } from "@/features/students/api/students.api";
import type { ApplicationTarget } from "@/features/students/types/student.types";
import { resolveUniversityByFormUrl } from "@/features/universities/api/universities.api";
import { isValidHttpUrl, normalizeFormUrl } from "../lib/form-url";

type ApplicationTargetsPanelProps = {
  studentId: string;
  targets: ApplicationTarget[];
  onTargetsChange: (targets: ApplicationTarget[]) => void;
};

export function ApplicationTargetsPanel({
  studentId,
  targets,
  onTargetsChange,
}: ApplicationTargetsPanelProps) {
  const [urlInput, setUrlInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedCount = useMemo(
    () => targets.filter((target) => Boolean(target.universityId)).length,
    [targets],
  );

  async function persistTargets(nextTargets: ApplicationTarget[]) {
    const formUrls = nextTargets
      .map((target) => target.formUrl?.trim())
      .filter((formUrl): formUrl is string => Boolean(formUrl));

    setIsSaving(true);
    setError(null);

    try {
      const profile = await setStudentApplicationTargets(studentId, formUrls);
      onTargetsChange(profile.applicationTargets);
    } catch {
      setError("Не удалось сохранить список вузов.");
      throw new Error("Failed to persist application targets.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAdd() {
    const trimmed = urlInput.trim();

    if (!trimmed) {
      setError("Вставьте URL формы вуза.");
      return;
    }

    if (!isValidHttpUrl(trimmed)) {
      setError("Нужен валидный http(s) URL.");
      return;
    }

    const normalized = normalizeFormUrl(trimmed);

    if (
      targets.some(
        (target) =>
          target.formUrl &&
          normalizeFormUrl(target.formUrl) === normalized,
      )
    ) {
      setError("Этот вуз уже добавлен.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const university = await resolveUniversityByFormUrl(trimmed);

      if (
        targets.some((target) => target.universityId === university.id)
      ) {
        setError("Этот вуз уже добавлен.");
        return;
      }

      const nextTargets: ApplicationTarget[] = [
        ...targets.filter((target) => Boolean(target.universityId)),
        {
          universityRaw: university.displayName,
          universityId: university.id,
          formUrl: university.formUrl,
        },
      ];

      const profile = await setStudentApplicationTargets(
        studentId,
        nextTargets
          .map((target) => target.formUrl)
          .filter((formUrl): formUrl is string => Boolean(formUrl)),
      );

      onTargetsChange(profile.applicationTargets);
      setUrlInput("");
    } catch (caught) {
      const status = getAxiosStatus(caught);

      if (status === 404) {
        setError("URL не совпал ни с одной известной схемой вуза.");
      } else if (status === 400) {
        setError("Некорректный URL.");
      } else {
        setError("Не удалось проверить URL вуза.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(universityId?: string, formUrl?: string) {
    const nextTargets = targets.filter((target) => {
      if (universityId && target.universityId === universityId) {
        return false;
      }

      if (!universityId && formUrl && target.formUrl === formUrl) {
        return false;
      }

      return true;
    });

    try {
      await persistTargets(nextTargets);
    } catch {
      // error already set
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Вузы для батча</h3>
          <p className="mt-1 text-xs text-slate-500">
            Вставьте URL формы подачи. Ссылка валидируется по схемам вузов.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
          {resolvedCount}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd().catch(() => undefined);
            }
          }}
          placeholder="https://apply.university.edu/..."
          disabled={isSaving}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
        />
        <button
          type="button"
          onClick={() => {
            handleAdd().catch(() => undefined);
          }}
          disabled={isSaving}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
        >
          {isSaving ? "..." : "Добавить"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}

      {targets.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Пока пусто — добавьте хотя бы один URL перед созданием батча.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {targets.map((target) => (
            <li
              key={target.id ?? `${target.universityId}-${target.formUrl}`}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">
                  {target.universityRaw}
                </div>
                {target.formUrl ? (
                  <a
                    href={target.formUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-sky-700 underline-offset-2 hover:underline"
                  >
                    {target.formUrl}
                  </a>
                ) : (
                  <div className="mt-1 text-xs text-amber-700">
                    URL не задан — вуз не резолвнут
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  handleRemove(target.universityId, target.formUrl).catch(
                    () => undefined,
                  );
                }}
                disabled={isSaving}
                className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getAxiosStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return undefined;
}
