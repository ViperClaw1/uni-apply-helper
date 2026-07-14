"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadStudentDocument } from "../api/documents.api";
import type { StudentDocument } from "../types/document.types";

type UploadStatus = "idle" | "uploading" | "done" | "error";

type DocumentUploaderProps = {
  studentId: string;
  type: string;
  label: string;
  existingDocument?: StudentDocument;
  onUploaded: () => Promise<void>;
};

export function DocumentUploader({
  studentId,
  type,
  label,
  existingDocument,
  onUploaded,
}: DocumentUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];

      if (!file) {
        return;
      }

      setStatus("uploading");

      try {
        await uploadStudentDocument(studentId, type, file);
        await onUploaded();
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [onUploaded, studentId, type],
  );

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    multiple: false,
    onDrop,
  });

  if (existingDocument) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-950">{label}</div>
            <div className="mt-1 text-xs font-medium text-emerald-700">
              {status === "uploading"
                ? "Загружаем новую версию..."
                : `Загружен · Парсинг: ${existingDocument.parseStatus}`}
            </div>
            {status === "error" ? (
              <div className="mt-1 text-xs font-medium text-rose-700">
                Ошибка повторной загрузки
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={existingDocument.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition-colors hover:bg-sky-50"
            >
              Открыть
            </a>
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
              {status === "uploading" ? "Загрузка..." : "Загрузить заново"}
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
