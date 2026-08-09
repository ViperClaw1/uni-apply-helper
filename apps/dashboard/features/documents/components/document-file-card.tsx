"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { useT } from "@/lib/i18n/context";
import type { StudentDocument } from "../types/document.types";

type DocumentFileCardProps = {
  document: StudentDocument;
  index: number;
  isDragging: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnd: () => void;
};

export function DocumentFileCard({
  document,
  index,
  isDragging,
  isDeleting,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}: DocumentFileCardProps) {
  const t = useT();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={[
        "group relative aspect-4/5 cursor-grab overflow-hidden rounded-xl bg-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-1 outline-black/10 active:cursor-grabbing",
        isDragging ? "opacity-50 ring-2 ring-sky-300" : "",
      ].join(" ")}
      title={t.documents.fileCard.dragToReorder}
    >
      <a
        href={document.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 block"
        onClick={(event) => {
          // Avoid accidental open while dragging
          if (isDragging) {
            event.preventDefault();
          }
        }}
      >
        <DocumentPreview fileUrl={document.fileUrl} />
      </a>

      <button
        type="button"
        title={t.documents.fileCard.deleteFile}
        aria-label={`${t.documents.fileCard.deleteFile} ${index + 1}`}
        disabled={isDeleting}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-slate-500 shadow-sm outline-1 outline-black/10 backdrop-blur-sm transition-[background-color,color,transform] hover:bg-rose-50 hover:text-rose-600 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
      >
        {isDeleting ? (
          <span className="text-[10px] font-semibold">…</span>
        ) : (
          <TrashIcon />
        )}
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/70 to-transparent px-2.5 pb-2.5 pt-8">
        <div className="truncate text-[11px] font-semibold text-white">
          {t.documents.fileCard.filePrefix}{index + 1}
        </div>
      </div>
    </div>
  );
}

function DocumentPreview({ fileUrl }: { fileUrl: string }) {
  const extension = getFileExtension(fileUrl);
  const [failed, setFailed] = useState(false);
  const canShowImage = isImageExtension(extension) && !failed;

  if (!canShowImage) {
    return <ExtensionPlaceholder extension={extension} />;
  }

  return (
    <img
      src={fileUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function ExtensionPlaceholder({ extension }: { extension: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-slate-500">
      <FileIcon />
      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200/80">
        {extension || "FILE"}
      </span>
    </div>
  );
}

function getFileExtension(fileUrl: string): string {
  try {
    const pathname = new URL(fileUrl).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toUpperCase() ?? "";
  } catch {
    const match = fileUrl.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    return match?.[1]?.toUpperCase() ?? "";
  }
}

function isImageExtension(extension: string) {
  return ["JPG", "JPEG", "PNG", "WEBP", "GIF", "BMP", "AVIF"].includes(
    extension.toUpperCase(),
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
