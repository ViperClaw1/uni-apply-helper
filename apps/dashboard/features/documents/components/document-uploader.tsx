"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadStudentDocument } from "../api/documents.api";
import type { StudentDocument } from "../types/document.types";

type UploadStatus = "idle" | "uploading" | "done" | "error";

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
  existingDocuments = [],
  onUploaded,
}: DocumentUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const existingDocument = existingDocuments[0];
  const hasDocuments = existingDocuments.length > 0;

  const onDrop = useCallback(
    async (files: File[]) => {
      const filesToUpload = multiple ? files : files.slice(0, 1);

      if (filesToUpload.length === 0) {
        return;
      }

      setStatus("uploading");

      try {
        await Promise.all(
          filesToUpload.map((file) => uploadStudentDocument(studentId, type, file)),
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
  }, [existingDocument, onUploaded, parse]);

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
                  ? multiple
                    ? "Добавляем файлы..."
                    : "Загружаем новую версию..."
                  : getUploadedStatusText(
                      existingDocument,
                      parse,
                      existingDocuments.length,
                    )}
              </div>
            ) : null}
            {status === "error" ? (
              <div className="mt-1 text-xs font-medium text-rose-700">
                Ошибка повторной загрузки
              </div>
            ) : null}
            {parse && existingDocument?.parseStatus === "failed" ? (
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                {formatParseError(existingDocument.parsedData)}
              </div>
            ) : null}
            {parse && existingDocument?.parseStatus === "parsed" ? (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
                {formatParsedPreview(type, existingDocument.parsedData)}
              </div>
            ) : null}
            {multiple ? (
              <div className="mt-3 grid gap-2">
                {existingDocuments.map((document, index) => (
                  <a
                    key={document.id}
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-sky-700 ring-1 ring-slate-200 transition-colors hover:bg-sky-50"
                  >
                    Файл {existingDocuments.length - index}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {existingDocument && !multiple ? (
              <a
                href={existingDocument.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition-colors hover:bg-sky-50"
              >
                Открыть
              </a>
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
              {status === "uploading"
                ? "Загрузка..."
                : multiple
                  ? "Добавить ещё"
                  : "Загрузить заново"}
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
      <div className="mt-1 text-xs text-slate-500">{getStatusText(status)}</div>
    </div>
  );
}

function getStatusText(status: UploadStatus) {
  const labels: Record<UploadStatus, string> = {
    done: "Загружено",
    error: "Ошибка загрузки",
    idle: "Перетащите PDF, JPG или PNG сюда",
    uploading: "Загрузка...",
  };

  return labels[status];
}

function getUploadedStatusText(
  document: StudentDocument,
  parse: boolean,
  documentCount: number,
) {
  if (!parse) {
    return documentCount > 1 ? `Загружено файлов: ${documentCount}` : "Загружен";
  }

  return `Загружен · Парсинг: ${formatParseStatus(document.parseStatus)}`;
}

function formatParseStatus(status: string) {
  const labels: Record<string, string> = {
    failed: "ошибка",
    parsed: "готово",
    pending: "в очереди",
    processing: "обработка",
    uploaded: "не требуется",
  };

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

const PASSPORT_FIELD_LABELS: Record<string, string> = {
  surname: "Фамилия",
  givenName: "Имя",
  dateOfBirth: "Дата рождения",
  nationality: "Гражданство",
  passportNo: "Номер паспорта",
  passportExpiry: "Срок действия",
  cityOfBirth: "Город рождения",
};

function formatParsedPreview(documentType: string, parsedData: unknown) {
  if (!parsedData || typeof parsedData !== "object") {
    return "Данные извлечены.";
  }

  const record = parsedData as Record<string, unknown>;

  if (documentType === "passport") {
    const lines = Object.entries(PASSPORT_FIELD_LABELS)
      .map(([key, label]) => {
        const value = record[key];

        if (value === null || value === undefined || value === "") {
          return null;
        }

        return `${label}: ${formatPreviewValue(value)}`;
      })
      .filter((line): line is string => line !== null);

    return lines.length > 0 ? lines.join(" · ") : "Данные извлечены.";
  }

  const entries = Object.entries(record)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${formatPreviewValue(value)}`);

  return entries.length > 0 ? entries.join(" · ") : "Данные извлечены.";
}

function formatParseError(parsedData: unknown) {
  if (parsedData && typeof parsedData === "object" && "error" in parsedData) {
    const error = (parsedData as { error?: unknown }).error;

    return typeof error === "string" ? error : "Не удалось распознать документ.";
  }

  return "Не удалось распознать документ.";
}

function formatPreviewValue(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} записей`;
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}
