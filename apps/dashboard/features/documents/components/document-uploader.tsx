"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useDropzone } from "react-dropzone";
import { toTitleCase } from "@/lib/format";
import { useT } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import {
  deleteStudentDocument,
  reorderStudentDocuments,
  retryDocumentParse,
  uploadStudentDocument,
} from "../api/documents.api";
import type { StudentDocument } from "../types/document.types";
import { DocumentFileCard } from "./document-file-card";

type UploadStatus = "idle" | "uploading" | "done" | "error";

const EMPTY_DOCUMENTS: StudentDocument[] = [];

type DocumentUploaderProps = {
  studentId: string;
  type: string;
  label: string;
  accept: Record<string, string[]>;
  parse: boolean;
  multiple?: boolean;
  existingDocuments?: StudentDocument[];
  onUploaded: () => Promise<void>;
};

export function DocumentUploader({
  studentId,
  type,
  label,
  accept,
  parse,
  multiple = false,
  existingDocuments = EMPTY_DOCUMENTS,
  onUploaded,
}: DocumentUploaderProps) {
  const t = useT();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [isRetryingParse, setIsRetryingParse] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [orderedDocs, setOrderedDocs] = useState(existingDocuments);
  const orderedDocsRef = useRef(orderedDocs);
  orderedDocsRef.current = orderedDocs;
  const existingDocument = orderedDocs[0];
  const hasDocuments = orderedDocs.length > 0;

  useEffect(() => {
    setOrderedDocs(
      [...existingDocuments].sort(
        (left, right) =>
          (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
          new Date(left.uploadedAt).getTime() -
            new Date(right.uploadedAt).getTime(),
      ),
    );
  }, [existingDocuments]);

  const onDrop = useCallback(
    async (files: File[]) => {
      const filesToUpload = multiple ? files : files.slice(0, 1);

      if (filesToUpload.length === 0) {
        return;
      }

      setStatus("uploading");

      try {
        await Promise.all(
          filesToUpload.map((file) =>
            uploadStudentDocument(studentId, type, file),
          ),
        );
        await onUploaded();
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [multiple, onUploaded, studentId, type],
  );

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept,
    maxFiles: multiple ? 0 : 1,
    multiple,
    onDrop,
    noDragEventsBubbling: true,
  });

  useEffect(() => {
    if (!parse || !existingDocument) {
      return;
    }

    if (!["pending", "processing"].includes(existingDocument.parseStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      onUploaded().catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [existingDocument?.id, existingDocument?.parseStatus, onUploaded, parse]);

  async function handleRetryParse() {
    if (!existingDocument) {
      return;
    }

    setIsRetryingParse(true);

    try {
      await retryDocumentParse(existingDocument.id);
      await onUploaded();
    } finally {
      setIsRetryingParse(false);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    try {
      await deleteStudentDocument(documentId);
      await onUploaded();
    } finally {
      setDeletingId(null);
    }
  }

  async function commitOrder(next: StudentDocument[]) {
    setOrderedDocs(next);
    try {
      await reorderStudentDocuments(
        studentId,
        type,
        next.map((document) => document.id),
      );
      await onUploaded();
    } catch {
      setOrderedDocs(existingDocuments);
    }
  }

  function onDragStart(documentId: string) {
    setDragId(documentId);
  }

  function onDragOver(event: DragEvent, overId: string) {
    event.preventDefault();
    if (!dragId || dragId === overId) {
      return;
    }

    setOrderedDocs((current) => {
      const from = current.findIndex((document) => document.id === dragId);
      const to = current.findIndex((document) => document.id === overId);
      if (from < 0 || to < 0 || from === to) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) {
        return current;
      }
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function onDragEnd() {
    if (!dragId) {
      return;
    }
    setDragId(null);
    await commitOrder(orderedDocsRef.current);
  }

  if (hasDocuments && multiple) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950">{label}</div>
            <div className="mt-1 text-xs font-medium text-emerald-700">
              {status === "uploading"
                ? t.documents.uploader.addingFiles
                : `${t.documents.uploader.filesUploadedPrefix}${orderedDocs.length}`}
            </div>
            {status === "error" ? (
              <div className="mt-1 text-xs font-medium text-rose-700">
                {t.documents.uploader.uploadError}
              </div>
            ) : null}
          </div>
          <div
            {...getRootProps()}
            className={[
              "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl px-3 text-xs font-semibold ring-1 transition-colors",
              status === "uploading"
                ? "pointer-events-none bg-slate-50 text-slate-400 ring-slate-200"
                : "text-slate-700 ring-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            <input {...getInputProps()} />
            {status === "uploading" ? t.documents.uploader.uploading : t.documents.uploader.addMore}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedDocs.map((document, index) => (
            <DocumentFileCard
              key={document.id}
              document={document}
              index={index}
              isDragging={dragId === document.id}
              isDeleting={deletingId === document.id}
              onDelete={() => void handleDelete(document.id)}
              onDragStart={() => onDragStart(document.id)}
              onDragOver={(event) => onDragOver(event, document.id)}
              onDragEnd={() => {
                void onDragEnd();
              }}
            />
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          {t.documents.uploader.reorderHint}
        </p>
      </div>
    );
  }

  if (hasDocuments) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950">{label}</div>
            {existingDocument ? (
              <div
                className={[
                  "mt-1 text-xs font-medium",
                  getParseStatusTone(existingDocument.parseStatus, parse),
                ].join(" ")}
              >
                {status === "uploading"
                  ? t.documents.uploader.uploadingNewVersion
                  : getUploadedStatusText(existingDocument, parse, 1, t)}
              </div>
            ) : null}
            {status === "error" ? (
              <div className="mt-1 text-xs font-medium text-rose-700">
                {t.documents.uploader.reuploadError}
              </div>
            ) : null}
            {parse && existingDocument?.parseStatus === "failed" ? (
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                {formatParseError(existingDocument.parsedData, t)}
              </div>
            ) : null}
            {parse && existingDocument?.parseStatus === "failed" ? (
              <button
                type="button"
                onClick={handleRetryParse}
                disabled={isRetryingParse}
                className="mt-2 inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                {isRetryingParse ? t.documents.uploader.retrying : t.documents.uploader.retryParsing}
              </button>
            ) : null}
            {parse && existingDocument?.parseStatus === "parsed" ? (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
                {formatParsedPreview(type, existingDocument.parsedData, t)}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {existingDocument ? (
              <a
                href={existingDocument.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition-colors hover:bg-sky-50"
              >
                {t.documents.uploader.open}
              </a>
            ) : null}
            {existingDocument ? (
              <button
                type="button"
                onClick={() => void handleDelete(existingDocument.id)}
                disabled={deletingId === existingDocument.id}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-50 disabled:opacity-60"
              >
                {deletingId === existingDocument.id ? "…" : t.common.delete}
              </button>
            ) : null}
            <div
              {...getRootProps()}
              className={[
                "inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-3 text-xs font-semibold ring-1 transition-colors",
                status === "uploading"
                  ? "pointer-events-none bg-slate-50 text-slate-400 ring-slate-200"
                  : "text-slate-700 ring-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              <input {...getInputProps()} />
              {status === "uploading" ? t.documents.uploader.uploading : t.documents.uploader.reupload}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={[
        "cursor-pointer rounded-2xl border border-dashed bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-colors",
        isDragActive
          ? "border-sky-400 bg-sky-50"
          : "border-slate-300 hover:border-slate-400",
        status === "uploading" ? "pointer-events-none opacity-60" : "",
        status === "done" ? "border-emerald-400 bg-emerald-50" : "",
        status === "error" ? "border-rose-400 bg-rose-50" : "",
      ].join(" ")}
    >
      <input {...getInputProps()} />
      <div className="text-sm font-semibold text-slate-950">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{getStatusText(status, t)}</div>
    </div>
  );
}

function getStatusText(status: UploadStatus, t: Dictionary) {
  const labels: Record<UploadStatus, string> = {
    done: t.documents.uploader.uploaded,
    error: t.documents.uploader.uploadError,
    idle: t.documents.uploader.idle,
    uploading: t.documents.uploader.uploading,
  };

  return labels[status];
}

function getUploadedStatusText(
  document: StudentDocument,
  parse: boolean,
  documentCount: number,
  t: Dictionary,
) {
  if (!parse) {
    return documentCount > 1
      ? `${t.documents.uploader.filesUploadedPrefix}${documentCount}`
      : t.documents.uploader.uploaded;
  }

  return `${t.documents.uploader.uploaded} · ${t.documents.uploader.parsingLabel}: ${formatParseStatus(document.parseStatus, t)}`;
}

function formatParseStatus(status: string, t: Dictionary) {
  const labels: Record<string, string> = t.documents.uploader.parseStatus;

  return labels[status] ?? status;
}

function getParseStatusTone(parseStatus: string, parse: boolean) {
  if (!parse) {
    return "text-emerald-700";
  }

  if (parseStatus === "parsed") {
    return "text-emerald-700";
  }

  if (parseStatus === "failed") {
    return "text-rose-700";
  }

  if (parseStatus === "pending" || parseStatus === "processing") {
    return "text-amber-700";
  }

  return "text-slate-600";
}

const PASSPORT_TITLE_CASE_FIELDS = new Set(["nationality", "cityOfBirth"]);

function formatParsedPreview(documentType: string, parsedData: unknown, t: Dictionary) {
  if (!parsedData || typeof parsedData !== "object") {
    return t.documents.uploader.dataExtracted;
  }

  const record = parsedData as Record<string, unknown>;
  const passportFieldLabels = t.documents.uploader.passportFields;

  if (documentType === "passport") {
    const lines = Object.entries(passportFieldLabels)
      .map(([key, label]) => {
        const value = record[key];

        if (value === null || value === undefined || value === "") {
          return null;
        }

        const formatted = formatPreviewValue(value);
        const display =
          PASSPORT_TITLE_CASE_FIELDS.has(key) && typeof value === "string"
            ? toTitleCase(value)
            : formatted;

        return `${label}: ${display}`;
      })
      .filter((line): line is string => line !== null);

    return lines.length > 0 ? lines.join(" · ") : t.documents.uploader.dataExtracted;
  }

  const entries = Object.entries(record)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${formatPreviewValue(value)}`);

  return entries.length > 0 ? entries.join(" · ") : t.documents.uploader.dataExtracted;
}

function formatParseError(parsedData: unknown, t: Dictionary) {
  if (parsedData && typeof parsedData === "object" && "error" in parsedData) {
    const error = (parsedData as { error?: unknown }).error;

    if (typeof error !== "string") {
      return t.documents.uploader.parseFailed;
    }

    const unavailableMatch = error.match(
      /"message":"([^"]+)"[^}]*"status":"UNAVAILABLE"/,
    );

    if (unavailableMatch?.[1]) {
      return unavailableMatch[1];
    }

    const notFoundMatch = error.match(/"message":"([^"]+)"/);

    if (notFoundMatch?.[1]) {
      return notFoundMatch[1];
    }

    return error.length > 240 ? `${error.slice(0, 240)}…` : error;
  }

  return t.documents.uploader.parseFailed;
}

function formatPreviewValue(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length}`;
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}
