"use client";

import { useEffect, useRef, useState } from "react";
import RFB from "@novnc/novnc";
import { useT } from "@/lib/i18n/context";
import { env } from "@/lib/env";
import {
  getReloginStatus,
  getUniversitySessions,
  mintReloginViewerTicket,
  renewUniversitySession,
} from "@/features/universities/api/universities.api";
import type { UniversitySession } from "@/features/universities/types/session.types";

type Phase = "idle" | "starting" | "waiting" | "success" | "error";
// No "connecting" state — the default "idle" already renders as "connecting" copy, since
// distinguishing it would mean calling setState synchronously in the effect's own frame
// (calling an async function still runs its pre-`await` code synchronously).
type ViewerStatus = "idle" | "connected" | "unavailable";

const VIEWER_MAX_RECONNECT_ATTEMPTS = 3;

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
  const [jobId, setJobId] = useState<string | undefined>();
  const [failureReason, setFailureReason] = useState<string | undefined>();
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("idle");
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);

  // Sanctioned React pattern for "adjust state when a prop changes" — runs during render, not
  // in an effect, so opening a different university's modal (or closing it — session becomes
  // null) resets state with no extra render. Refs can't be touched here (only setState is
  // blessed during render) — `phase` leaving "waiting" is what the viewer effect below keys
  // its own cleanup off, which is where the actual RFB teardown happens.
  if (session?.universityId !== loadedUniversityId) {
    setLoadedUniversityId(session?.universityId);
    setPhase("idle");
    setProfilePath(undefined);
    setJobId(undefined);
    setFailureReason(undefined);
    setViewerStatus("idle");
  }

  useEffect(() => {
    if (phase !== "waiting" || !session) {
      return;
    }

    const universityId = session.universityId;
    const intervalId = window.setInterval(async () => {
      // Job status first — a dead job (e.g. this worker can't open a headed browser at all)
      // never flips the session to "active", so without this the modal waits forever.
      if (jobId) {
        try {
          const jobStatus = await getReloginStatus(jobId);

          if (jobStatus.status === "failed") {
            setFailureReason(jobStatus.failedReason);
            setPhase("error");
            return;
          }
        } catch {
          // transient poll failure — fall through and check session status this tick anyway
        }
      }

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
  }, [phase, session, jobId]);

  // Live viewer — a side channel, never the source of truth. If the noVNC connection itself
  // flakes, that must never be confused with the job failing; the polling above (untouched)
  // stays the only thing that decides success/failure.
  const wsOrigin = env.apiWsOrigin;

  useEffect(() => {
    if (phase !== "waiting" || !jobId || !viewerContainerRef.current || !wsOrigin) {
      return;
    }

    const container = viewerContainerRef.current;
    let cancelled = false;
    let attempt = 0;

    async function connect() {
      if (cancelled) {
        return;
      }

      try {
        const { ticket } = await mintReloginViewerTicket(jobId!);

        if (cancelled) {
          return;
        }

        const wsUrl = `${wsOrigin!.replace(/^http/, "ws")}/ws/relogin-viewer?ticket=${ticket}`;
        const rfb = new RFB(container, wsUrl);
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfbRef.current = rfb;

        rfb.addEventListener("connect", () => {
          if (!cancelled) {
            setViewerStatus("connected");
          }
        });

        rfb.addEventListener("disconnect", () => {
          rfbRef.current = null;

          if (cancelled) {
            return;
          }

          if (attempt < VIEWER_MAX_RECONNECT_ATTEMPTS) {
            attempt += 1;
            window.setTimeout(connect, 2000 * attempt);
          } else {
            setViewerStatus("unavailable");
          }
        });
      } catch {
        if (!cancelled) {
          setViewerStatus("unavailable");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      rfbRef.current?.disconnect();
      rfbRef.current = null;
    };
  }, [phase, jobId, wsOrigin]);

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
    setFailureReason(undefined);

    try {
      const result = await renewUniversitySession(session!.universityId);
      setProfilePath(result.profilePath);
      setJobId(result.jobId);
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
        className={`relative w-full rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-[max-width] ${
          isBusy ? "max-w-3xl" : "max-w-md"
        }`}
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

            <div className="relative mt-3 aspect-[6/5] w-full overflow-hidden rounded-xl bg-slate-900">
              <div ref={viewerContainerRef} className="h-full w-full" />
              {viewerStatus !== "connected" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium text-slate-400">
                  {viewerStatus === "unavailable" || !wsOrigin
                    ? t.dashboard.renewModal.viewerUnavailable
                    : t.dashboard.renewModal.viewerConnecting}
                </div>
              ) : (
                // Caps Lock is a toggle key — browsers are notoriously unreliable about firing
                // clean keydown/keyup for it, so the remote X session's lock state can silently
                // desync from what the browser thinks it's sending. sendKey() injects an
                // explicit press+release, bypassing that native handling entirely.
                <button
                  type="button"
                  onClick={() => rfbRef.current?.sendKey(0xffe5, "CapsLock")}
                  className="absolute right-2 top-2 cursor-pointer rounded-lg bg-slate-950/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-slate-950/90"
                >
                  {t.dashboard.renewModal.toggleCapsLock}
                </button>
              )}
            </div>

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
                {failureReason ?? t.dashboard.renewModal.failed}
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
