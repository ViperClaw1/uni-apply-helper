"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import {
  getUniversitySessions,
  renewUniversitySession,
} from "@/features/universities/api/universities.api";
import type { UniversitySession } from "@/features/universities/types/session.types";

type Phase = "idle" | "starting" | "waiting" | "success" | "error";

type RenewSessionModalProps = {
  session: UniversitySession | null;
  onClose: () => void;
  onRenewed: () => void;
};

export function RenewSessionModal({ session, onClose, onRenewed }: RenewSessionModalProps) {
  const t = useT();
  const [loadedUniversityId, setLoadedUniversityId] = useState(session?.universityId);
  const [phase, setPhase] = useState<Phase>("idle");
  const [profilePath, setProfilePath] = useState<string | undefined>();

  // Sanctioned React pattern for "adjust state when a prop changes" — runs during render, not
  // in an effect, so opening a different university's modal resets state with no extra render.
  if (session?.universityId !== loadedUniversityId) {
    setLoadedUniversityId(session?.universityId);
    setPhase("idle");
    setProfilePath(undefined);
  }

  useEffect(() => {
    if (phase !== "waiting" || !session) {
      return;
    }

    const universityId = session.universityId;
    const intervalId = window.setInterval(async () => {
      try {
        const sessions = await getUniversitySessions();
        const updated = sessions.find((item) => item.universityId === universityId);

        if (updated?.status === "active") {
          setPhase("success");
        }
      } catch {
        // transient poll failure — keep waiting, the worker's login flow can take minutes
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [phase, session]);

  if (!session) {
    return null;
  }

  async function handleOpenLogin() {
    // Belt-and-suspenders alongside the button's `disabled` — closes the window where a fast
    // double-click could fire the job twice before the disabled state paints.
    if (phase === "starting" || phase === "waiting") {
      return;
    }

    setPhase("starting");

    try {
      const result = await renewUniversitySession(session!.universityId);
      setProfilePath(result.profilePath);
      setPhase("waiting");
    } catch {
      setPhase("error");
    }
  }

  const message =
    session.status === "login_required"
      ? t.dashboard.renewModal.loginRequiredMessage
      : session.status === "attention_required"
        ? t.dashboard.renewModal.attentionRequiredMessage
        : t.dashboard.renewModal.expiredMessage;
  const isBusy = phase === "starting" || phase === "waiting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)] ring-1 ring-black/5"
      >
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {t.dashboard.renewModal.titlePrefix}
          {session.displayName}
        </h2>

        {phase === "success" ? (
          <p className="mt-4 text-sm font-medium text-emerald-700">
            {t.dashboard.renewModal.success}
          </p>
        ) : isBusy ? (
          <>
            <p className="mt-4 text-sm text-slate-600">{t.dashboard.renewModal.waiting}</p>
            {profilePath ? (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                {profilePath}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-400">{t.dashboard.renewModal.canCloseHint}</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            {phase === "error" ? (
              <p className="mt-2 text-sm font-medium text-rose-700">
                {t.dashboard.renewModal.failed}
              </p>
            ) : null}
            <p className="mt-4 text-xs text-slate-400">{t.dashboard.renewModal.afterLogin}</p>
          </>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={phase === "success" ? onRenewed : onClose}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            {phase === "success" || isBusy
              ? t.dashboard.renewModal.close
              : t.dashboard.renewModal.cancel}
          </button>
          {phase !== "success" ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleOpenLogin}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-60"
            >
              {t.dashboard.renewModal.openLogin}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
