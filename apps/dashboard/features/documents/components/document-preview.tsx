"use client";

import { useState } from "react";

export function DocumentPreview({ fileUrl }: { fileUrl: string }) {
  const extension = getFileExtension(fileUrl);
  const [failed, setFailed] = useState(false);

  if (!failed && isImageExtension(extension)) {
    return (
      <img
        src={fileUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  // <img> can't decode PDF content — the browser's own PDF viewer can, via <iframe>/<embed>.
  // pointer-events-none keeps its internal scrolling/toolbar from swallowing the card's own
  // click-to-open and drag-to-reorder handlers; it's a thumbnail, not an interactive viewer.
  if (!failed && extension === "PDF") {
    return (
      <iframe
        src={`${fileUrl}#toolbar=0&navpanes=0&view=FitH`}
        title=""
        className="pointer-events-none h-full w-full"
        onError={() => setFailed(true)}
      />
    );
  }

  return <ExtensionPlaceholder extension={extension} />;
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
