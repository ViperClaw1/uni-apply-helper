"use client";

import type { DragEvent } from "react";
import { useT } from "@/lib/i18n/context";
import type { StudentDocument } from "../types/document.types";
import { DocumentPreview } from "./document-preview";

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
