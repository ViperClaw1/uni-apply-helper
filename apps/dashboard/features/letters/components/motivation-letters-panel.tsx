"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveLetter,
  generateLetter,
  getStudentLetters,
  unapproveLetter,
} from "../api/letters.api";
import {
  canApproveLetter,
  formatLetterPreview,
  getUniversityLabel,
} from "../lib/letter-utils";
import type { MotivationLetter } from "../types/letter.types";
import type {
  ApplicationTarget,
  StudentProfile,
} from "@/features/students/types/student.types";

type MotivationLettersPanelProps = {
  student: StudentProfile;
  highlightUniversityId?: string;
};

export function MotivationLettersPanel({
  student,
  highlightUniversityId,
}: MotivationLettersPanelProps) {
  const studentId = student.id;
  const [letters, setLetters] = useState<MotivationLetter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [generatingUniversityId, setGeneratingUniversityId] = useState<string | null>(
    null,
  );
  const [expandedLetterId, setExpandedLetterId] = useState<string | null>(null);
  const [approvalConfirmed, setApprovalConfirmed] = useState<Record<string, boolean>>(
    {},
  );
  const [pendingAction, setPendingAction] = useState<{
    letterId: string;
    type: "approve" | "unapprove";
  } | null>(null);

  const generatableTargets = useMemo(
    () =>
      student.applicationTargets.filter(
        (target): target is ApplicationTarget & { universityId: string } =>
          Boolean(target.universityId),
      ),
    [student.applicationTargets],
  );

  const loadLetters = useCallback(async () => {
    setError(null);

    try {
      setLetters(await getStudentLetters(studentId));
    } catch {
      setError("Не удалось загрузить мотивационные письма.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadLetters().catch(() => undefined);
  }, [loadLetters]);

  useEffect(() => {
    if (!highlightUniversityId) {
      return;
    }

    const targetLetter = letters.find(
      (letter) => letter.universityId === highlightUniversityId,
    );

    if (targetLetter) {
      setExpandedLetterId(targetLetter.id);
    }
  }, [highlightUniversityId, letters]);

  const studentName = [student.personal.givenName, student.personal.surname]
    .filter(Boolean)
    .join(" ");

  async function handleGenerate(universityId: string) {
    setGeneratingUniversityId(universityId);
    setActionError(null);

    try {
      const letter = await generateLetter({ studentId, universityId });
      setLetters((current) => [letter, ...current]);
      setExpandedLetterId(letter.id);
      setApprovalConfirmed((current) => ({ ...current, [letter.id]: false }));
    } catch {
      setActionError("Не удалось сгенерировать письмо. Проверь GEMINI_API_KEY на API.");
    } finally {
      setGeneratingUniversityId(null);
    }
  }

  async function handleApprove(letter: MotivationLetter) {
    if (!canApproveLetter(letter, studentId, approvalConfirmed[letter.id] ?? false)) {
      return;
    }

    setPendingAction({ letterId: letter.id, type: "approve" });
    setActionError(null);

    try {
      const updated = await approveLetter(letter.id);
      setLetters((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setApprovalConfirmed((current) => ({ ...current, [letter.id]: false }));
    } catch {
      setActionError("Не удалось одобрить письмо.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnapprove(letter: MotivationLetter) {
    setPendingAction({ letterId: letter.id, type: "unapprove" });
    setActionError(null);

    try {
      const updated = await unapproveLetter(letter.id);
      setLetters((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setActionError("Не удалось снять одобрение.");
    } finally {
      setPendingAction(null);
    }
  }

  function toggleExpanded(letterId: string) {
    setExpandedLetterId((current) => (current === letterId ? null : letterId));
    setApprovalConfirmed((current) => ({ ...current, [letterId]: false }));
  }

  return (
    <section
      id="motivation-letters"
      className="scroll-mt-24 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Мотивационные письма
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Сгенерируй, проверь имя студента в тексте и одобри перед подачей заявок.
        </p>
      </div>

      {generatableTargets.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {generatableTargets.map((target) => (
            <div
              key={target.universityId}
              id={`motivation-letter-${target.universityId}`}
              className="scroll-mt-24"
            >
              <button
                type="button"
                onClick={() => handleGenerate(target.universityId)}
                disabled={generatingUniversityId !== null}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
              >
                {generatingUniversityId === target.universityId
                  ? "Генерируем..."
                  : `Сгенерировать · ${target.universityRaw}`}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
          Нет вузов с привязанным universityId — генерация недоступна.
        </div>
      )}

      {actionError ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {actionError}
        </div>
      ) : null}

      <div className="mt-5">
        {isLoading ? (
          <div className="text-sm text-slate-500">Загрузка писем...</div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        ) : letters.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Писем пока нет.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {letters.map((letter) => {
              const isExpanded = expandedLetterId === letter.id;
              const isHighlighted = letter.universityId === highlightUniversityId;
              const isApproving =
                pendingAction?.letterId === letter.id &&
                pendingAction.type === "approve";
              const isUnapproving =
                pendingAction?.letterId === letter.id &&
                pendingAction.type === "unapprove";
              const universityLabel = getUniversityLabel(
                student.applicationTargets,
                letter.universityId,
              );
              const studentMismatch = letter.studentId !== studentId;
              const confirmed = approvalConfirmed[letter.id] ?? false;

              return (
                <article
                  key={letter.id}
                  id={`motivation-letter-${letter.universityId}`}
                  className={[
                    "py-4 first:pt-0 last:pb-0",
                    isHighlighted ? "rounded-xl bg-amber-50/70 px-3 -mx-3" : "",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(letter.id)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">
                        {universityLabel}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 tabular-nums">
                        {letter.universityId} ·{" "}
                        {new Intl.DateTimeFormat("ru-RU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(letter.generatedAt))}
                      </div>
                      {!isExpanded ? (
                        <p className="mt-2 text-sm text-slate-600">
                          {formatLetterPreview(letter.content)}
                        </p>
                      ) : null}
                    </div>
                    <LetterStatusBadge approved={letter.approvedByConsultant} />
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
                        <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                          Сверка перед одобрением
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-950">
                          {studentName || "Имя не указано"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {student.personal.email || "Email не указан"}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Вуз: {universityLabel} ({letter.universityId})
                        </div>
                        {studentMismatch ? (
                          <div className="mt-2 text-xs font-semibold text-rose-700">
                            Ошибка матчинга: letter.studentId не совпадает с карточкой.
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Текст письма
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                          {letter.content}
                        </div>
                      </div>

                      {letter.approvedByConsultant ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-xs text-emerald-700">
                            Одобрено{" "}
                            {letter.approvedAt
                              ? new Intl.DateTimeFormat("ru-RU", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(new Date(letter.approvedAt))
                              : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnapprove(letter)}
                            disabled={pendingAction !== null}
                            className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-amber-50 disabled:opacity-60"
                          >
                            {isUnapproving ? "Снимаем..." : "Снять одобрение"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="flex items-start gap-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={confirmed}
                              disabled={studentMismatch}
                              onChange={(event) =>
                                setApprovalConfirmed((current) => ({
                                  ...current,
                                  [letter.id]: event.target.checked,
                                }))
                              }
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                            <span>
                              Подтверждаю: письмо относится к этому студенту и вузу, имя
                              и данные в тексте проверены.
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleApprove(letter)}
                            disabled={
                              !canApproveLetter(letter, studentId, confirmed) ||
                              pendingAction !== null
                            }
                            className="inline-flex h-10 items-center rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-60"
                          >
                            {isApproving ? "Одобряем..." : "Одобрить письмо"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function LetterStatusBadge({ approved }: { approved: boolean }) {
  return (
    <span
      className={[
        "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ring-1",
        approved
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-amber-50 text-amber-700 ring-amber-100",
      ].join(" ")}
    >
      {approved ? "Одобрено" : "Черновик"}
    </span>
  );
}
