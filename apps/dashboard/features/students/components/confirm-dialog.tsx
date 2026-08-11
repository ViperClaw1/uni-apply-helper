"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/context";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  const resolvedConfirmLabel = confirmLabel ?? t.common.delete;
  const resolvedCancelLabel = cancelLabel ?? t.common.cancel;
  const resolvedPendingLabel = pendingLabel ?? t.students.list.deleting;
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isPending, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t.common.close}
        disabled={isPending}
        onClick={onCancel}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)] ring-1 ring-black/5"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold tracking-tight text-slate-950"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm leading-6 text-slate-600"
        >
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? resolvedPendingLabel : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
