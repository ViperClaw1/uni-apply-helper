import type { CSSProperties } from "react";
import { HOW_IT_WORKS_SLIDES } from "../constants/how-it-works";

const SLIDE_SECONDS = 4;
const TOTAL_SECONDS = SLIDE_SECONDS * HOW_IT_WORKS_SLIDES.length;

const MOCK_DOCUMENTS = ["Passport scan", "Diploma", "Transcript", "Photo"];
const MOCK_UNIVERSITIES = [
  { name: "Peking University", picked: true },
  { name: "Nanjing University", picked: true },
  { name: "Sichuan University", picked: true },
  { name: "Beijing University of Technology", picked: false },
];
const APPLY_UNIVERSITY_COUNT = 3;

function slideAnimation(name: string, delaySeconds: number): CSSProperties {
  return {
    animationName: name,
    animationDuration: `${TOTAL_SECONDS}s`,
    animationDelay: `${-delaySeconds}s`,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  };
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-slate-100 bg-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            How it works
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
            One profile, every step of the way
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-500">
            From filling in your personal details to tracking every
            application — here&apos;s the whole flow, on autoplay.
          </p>
        </div>

        <div className="relative mx-auto mt-10 h-[420px] max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <div className="flex h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>

          {HOW_IT_WORKS_SLIDES.map((slide, index) => {
            const delaySeconds = index * SLIDE_SECONDS;
            return (
              <div
                key={index}
                className="absolute inset-x-0 top-9 bottom-0 p-6"
                style={slideAnimation("how-it-works-slide", delaySeconds)}
              >
                {slide.kind === "form" ? (
                  <FormSlide {...slide} delaySeconds={delaySeconds} />
                ) : slide.kind === "upload" ? (
                  <UploadSlide />
                ) : slide.kind === "universities" ? (
                  <UniversitiesSlide />
                ) : slide.kind === "apply" ? (
                  <ApplySlide delaySeconds={delaySeconds} />
                ) : (
                  <StatusSlide delaySeconds={delaySeconds} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FormSlide({
  step,
  title,
  fields,
  delaySeconds,
}: {
  step: string;
  title: string;
  fields: { label: string; labelEn: string; value: string }[];
  delaySeconds: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600"
          style={slideAnimation("how-it-works-progress", delaySeconds)}
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-blue-600">{step}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">{title}</h3>

      <div className="mt-4 flex flex-col gap-2.5">
        {fields.map((field) => (
          <div key={field.labelEn}>
            <div className="text-[11px] text-slate-400">
              {field.label} / {field.labelEn}
            </div>
            <div className="mt-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadSlide() {
  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold text-blue-600">Documents</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        Upload your documents
      </h3>
      <div className="mt-4 flex flex-col gap-2.5">
        {MOCK_DOCUMENTS.map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <span className="text-xs font-medium text-slate-800">{name}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckIcon />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UniversitiesSlide() {
  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold text-blue-600">Universities</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        Choose universities &amp; majors
      </h3>
      <div className="mt-4 flex flex-col gap-2.5">
        {MOCK_UNIVERSITIES.map((university) => (
          <div
            key={university.name}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
              university.picked
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="text-xs font-medium text-slate-800">
              {university.name}
            </span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md border text-white ${
                university.picked
                  ? "border-blue-600 bg-blue-600"
                  : "border-slate-300 bg-white"
              }`}
            >
              {university.picked ? <CheckIcon /> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplySlide({ delaySeconds }: { delaySeconds: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs font-semibold text-blue-600">One click</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        Apply to all your universities
      </h3>

      <div className="relative mt-6 flex h-12 w-56 items-center justify-center">
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white"
          style={slideAnimation("how-it-works-apply-loading", delaySeconds)}
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Submitting…
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
          style={slideAnimation("how-it-works-apply-done", delaySeconds)}
        >
          <CheckIcon />
          {APPLY_UNIVERSITY_COUNT} applications submitted
        </div>
      </div>
    </div>
  );
}

function StatusSlide({ delaySeconds }: { delaySeconds: number }) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold text-blue-600">Status</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950">
        Track every application
      </h3>
      <div className="mt-4 flex flex-col gap-2.5">
        <StatusRow name="Peking University" tone="ring-emerald-100 bg-emerald-50 text-emerald-700" label="Submitted" />
        <StatusRow name="Nanjing University" tone="ring-emerald-100 bg-emerald-50 text-emerald-700" label="Submitted" />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="text-xs font-medium text-slate-800">
            Sichuan University
          </span>
          <span className="relative inline-flex h-5 w-24 shrink-0 items-center justify-end">
            <span
              className="absolute right-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200"
              style={slideAnimation("how-it-works-status-a", delaySeconds)}
            >
              Draft
            </span>
            <span
              className="absolute right-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100"
              style={slideAnimation("how-it-works-status-b", delaySeconds)}
            >
              In progress
            </span>
            <span
              className="absolute right-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100"
              style={slideAnimation("how-it-works-status-c", delaySeconds)}
            >
              Submitted
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  name,
  label,
  tone,
}: {
  name: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="text-xs font-medium text-slate-800">{name}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>
        {label}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
