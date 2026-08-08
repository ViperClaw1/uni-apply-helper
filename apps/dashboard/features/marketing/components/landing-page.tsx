import { SUPPORTED_UNIVERSITIES } from "../constants/universities";
import { HowItWorksSection } from "./how-it-works-section";

const NAV_LINKS = ["How it works", "Universities", "For students", "Resources", "Help"];

const PROFILE_STEPS = [
  "Personal info",
  "Education",
  "Documents",
  "Test scores",
  "Languages",
];

type ApplicationStatus = "Submitted" | "In progress" | "Ready to submit" | "Draft";

const APPLICATION_TARGETS: { nameEn: string; nameZh: string; status: ApplicationStatus; color: string }[] = [
  { nameEn: "Peking University", nameZh: "北京大学", status: "Submitted", color: "#e11d48" },
  { nameEn: "Nanjing University", nameZh: "南京大学", status: "Submitted", color: "#7c3aed" },
  { nameEn: "Sichuan University", nameZh: "四川大学", status: "In progress", color: "#f97316" },
  { nameEn: "Beijing University of Technology", nameZh: "北京工业大学", status: "Ready to submit", color: "#059669" },
  { nameEn: "Southwest Jiaotong University", nameZh: "西南交通大学", status: "Draft", color: "#2563eb" },
];

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  Submitted: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "In progress": "bg-amber-50 text-amber-700 ring-amber-100",
  "Ready to submit": "bg-blue-50 text-blue-700 ring-blue-100",
  Draft: "bg-slate-100 text-slate-500 ring-slate-200",
};

const FEATURES = [
  {
    icon: <ClockIcon />,
    title: "Save time",
    description: "No more repetitive forms",
  },
  {
    icon: <ShieldIcon />,
    title: "Fewer errors",
    description: "We follow each university's rules",
  },
  {
    icon: <DocumentIcon />,
    title: "Apply to more",
    description: "Universities, one profile",
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <HowItWorksSection />
        <SupportedUniversitiesSection />
      </main>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-slate-100">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <LogoPlaceholder />
          <span className="text-lg font-semibold tracking-tight text-slate-950">
            LotsApply
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((label) =>
            label === "How it works" ? (
              <a
                key={label}
                href="#how-it-works"
                className="text-sm font-medium text-slate-600 hover:text-slate-950"
              >
                {label}
              </a>
            ) : (
              <span
                key={label}
                className="flex select-none items-center gap-1 text-sm font-medium text-slate-600"
              >
                {label}
                {label === "Resources" ? <ChevronDownIcon /> : null}
              </span>
            ),
          )}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden text-sm font-medium text-slate-600 sm:inline-flex"
          >
            Log in
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Get started — it&apos;s free
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
      <div>
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          For international students
        </span>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Fill it once.
          <br />
          <span className="text-blue-600">Apply everywhere.</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-slate-500">
          Create one profile, upload your documents, and let LotsApply
          automatically fill university forms so you can apply to multiple
          universities with ease.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm"
          >
            Create your profile
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 text-sm font-semibold text-slate-700"
          >
            <PlayIcon />
            See how it works
          </button>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-blue-600">{feature.icon}</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {feature.title}
                </div>
                <div className="text-xs text-slate-500">
                  {feature.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute -top-6 right-2 text-blue-300">
          <PaperPlaneIcon />
        </span>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
            <h2 className="text-sm font-semibold text-slate-950">
              Your profile
            </h2>
            <ul className="mt-4 flex flex-col gap-3.5">
              {PROFILE_STEPS.map((step) => (
                <li
                  key={step}
                  className="flex items-center justify-between text-sm text-slate-600"
                >
                  {step}
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckIcon />
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
              <span className="mt-0.5 text-emerald-600">
                <LockIcon />
              </span>
              <p className="text-xs leading-5 text-emerald-800">
                Your data is secure and used only for your applications.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
            <h2 className="text-sm font-semibold text-slate-950">
              Apply to multiple universities
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {APPLICATION_TARGETS.map((target) => (
                <li
                  key={target.nameEn}
                  className="flex items-center gap-2.5"
                >
                  <UniversityBadge
                    initial={target.nameZh.charAt(0)}
                    color={target.color}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                    {target.nameEn}{" "}
                    <span className="text-slate-400">({target.nameZh})</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_STYLES[target.status]}`}
                  >
                    {target.status}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2.5 border-t border-slate-100 pt-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <BankIcon />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-blue-700">
                  And more universities...
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  We add new universities regularly.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportedUniversitiesSection() {
  return (
    <section className="border-t border-slate-100 bg-slate-50/60">
      <div className="mx-auto w-full max-w-7xl px-6 py-14">
        <p className="text-center text-xs font-semibold tracking-wide text-slate-400">
          20+ CHINESE UNIVERSITIES ALREADY SUPPORTED
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SUPPORTED_UNIVERSITIES.map((university) => (
            <div
              key={university.nameEn}
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-black/5"
            >
              <UniversityBadge
                initial={university.nameZh.charAt(0)}
                color={university.color}
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-800">
                  {university.nameZh}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {university.nameEn}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <span className="inline-flex select-none items-center gap-1.5 text-sm font-semibold text-blue-600">
            View all supported universities
            <ArrowRightIcon />
          </span>
        </div>
      </div>
    </section>
  );
}

function UniversityBadge({ initial, color }: { initial: string; color: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {initial}
    </span>
  );
}

function LogoPlaceholder() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
      L
    </span>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3.5 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4h4M9 12h6M9 16h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4.5v15l14-7.5-14-7.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
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

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10h16M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18M12 3l8 4H4l8-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 3 3 10.5l7 2.5m11-10L13.5 20l-2.5-7m10-10-8.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
