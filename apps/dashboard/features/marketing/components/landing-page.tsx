"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Header } from "@/components/header";
import { useT } from "@/lib/i18n/context";
import { AuthModal } from "@/features/auth/components/auth-modal";
import type { Account } from "@/features/auth/api/auth.api";
import { SUPPORTED_UNIVERSITIES } from "../constants/universities";
import { HowItWorksSection } from "./how-it-works-section";

type Mode = "students" | "agencies";

const NAV_ITEMS = [
  { kind: "anchor", anchor: "how-it-works", labelKey: "navHowItWorks" },
  { kind: "anchor", anchor: "universities", labelKey: "navUniversities" },
  { kind: "mode", mode: "students", labelKey: "navForStudents" },
  { kind: "mode", mode: "agencies", labelKey: "navForAgencies" },
  { kind: "text", labelKey: "navResources", chevron: true },
  { kind: "text", labelKey: "navHelp", chevron: false },
] as const;

type ApplicationStatus = "submitted" | "inProgress" | "ready" | "draft";

const APPLICATION_TARGETS: { nameEn: string; nameZh: string; status: ApplicationStatus; color: string }[] = [
  { nameEn: "Peking University", nameZh: "北京大学", status: "submitted", color: "#e11d48" },
  { nameEn: "Nanjing University", nameZh: "南京大学", status: "submitted", color: "#7c3aed" },
  { nameEn: "Sichuan University", nameZh: "四川大学", status: "inProgress", color: "#f97316" },
  { nameEn: "Beijing University of Technology", nameZh: "北京工业大学", status: "ready", color: "#059669" },
  { nameEn: "Southwest Jiaotong University", nameZh: "西南交通大学", status: "draft", color: "#2563eb" },
];

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  submitted: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  inProgress: "bg-amber-50 text-amber-700 ring-amber-100",
  ready: "bg-blue-50 text-blue-700 ring-blue-100",
  draft: "bg-slate-100 text-slate-500 ring-slate-200",
};

const AGENCY_TRUST_LOGOS = [
  "EduGlobal Consultants",
  "Globalway Education",
  "Bright Future Consulting",
  "Apex Education",
  "Orbit Admissions",
  "StudyPath International",
];

export function LandingPage({ account }: { account: Account | null }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("students");
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    initialMode: "login" | "signup";
  }>({ open: false, initialMode: "signup" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const isLoggedInStudent = account?.role === "student";

  const nav = (
    <nav className="hidden items-center gap-8 min-[1040px]:flex">
      {NAV_ITEMS.map((item) => {
        const label = t.header[item.labelKey];

        if (item.kind === "anchor") {
          return (
            <a
              key={item.labelKey}
              href={`#${item.anchor}`}
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              {label}
            </a>
          );
        }

        if (item.kind === "mode") {
          return (
            <button
              key={item.labelKey}
              type="button"
              onClick={() => setMode(item.mode)}
              className={`cursor-pointer text-sm font-medium ${
                mode === item.mode ? "text-blue-600" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              {label}
            </button>
          );
        }

        return (
          <span
            key={item.labelKey}
            className="flex select-none items-center gap-1 text-sm font-medium text-slate-600"
          >
            {label}
            {item.chevron ? <ChevronDownIcon /> : null}
          </span>
        );
      })}
    </nav>
  );

  const actions = (
    <>
      {isLoggedInStudent ? (
        <Link
          href="/dashboard"
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm"
        >
          {t.header.myApplications}
        </Link>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAuthModal({ open: true, initialMode: "login" })}
            className="hidden cursor-pointer text-sm font-medium text-slate-600 sm:inline-flex"
          >
            {t.header.logIn}
          </button>
          <button
            type="button"
            onClick={() => setAuthModal({ open: true, initialMode: "signup" })}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            {mode === "students" ? t.header.getStarted : t.header.bookDemo}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-label={mobileMenuOpen ? t.header.closeMenu : t.header.openMenu}
        aria-expanded={mobileMenuOpen}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-50 min-[1040px]:hidden"
      >
        <BurgerIcon open={mobileMenuOpen} />
      </button>
    </>
  );

  const mobileMenu = (
    <div
      aria-hidden={!mobileMenuOpen}
      className={`fixed inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-100 bg-white px-6 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)] transition-all duration-200 ease-out min-[1040px]:hidden ${
        mobileMenuOpen
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const label = t.header[item.labelKey];
          const itemClassName =
            "rounded-lg px-2 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950";

          if (item.kind === "anchor") {
            return (
              <a
                key={item.labelKey}
                href={`#${item.anchor}`}
                onClick={closeMobileMenu}
                className={itemClassName}
              >
                {label}
              </a>
            );
          }

          if (item.kind === "mode") {
            return (
              <button
                key={item.labelKey}
                type="button"
                onClick={() => {
                  setMode(item.mode);
                  closeMobileMenu();
                }}
                className={`cursor-pointer ${itemClassName} ${
                  mode === item.mode ? "text-blue-600" : ""
                }`}
              >
                {label}
              </button>
            );
          }

          return (
            <span key={item.labelKey} className={`flex select-none items-center gap-1 ${itemClassName}`}>
              {label}
              {item.chevron ? <ChevronDownIcon /> : null}
            </span>
          );
        })}
      </nav>

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
        {isLoggedInStudent ? (
          <Link
            href="/dashboard"
            onClick={closeMobileMenu}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            {t.header.myApplications}
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setAuthModal({ open: true, initialMode: "login" });
                closeMobileMenu();
              }}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              {t.header.logIn}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModal({ open: true, initialMode: "signup" });
                closeMobileMenu();
              }}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm"
            >
              {mode === "students" ? t.header.getStarted : t.header.bookDemo}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header
        variant="site"
        title={t.header.brand}
        nav={nav}
        actions={actions}
        mobileMenu={mobileMenu}
      />
      <main className="flex-1">
        {mode === "students" ? (
          <>
            <HeroSection
              onOpenAuth={(initialMode) =>
                setAuthModal({ open: true, initialMode })
              }
            />
            <HowItWorksSection />
            <SupportedUniversitiesSection />
          </>
        ) : (
          <>
            <AgencyHeroSection />
            <TrustedByAgenciesSection />
            <AgencyStatsSection />
            <HowItWorksSection />
          </>
        )}
      </main>
      <AuthModal
        open={authModal.open}
        initialMode={authModal.initialMode}
        initialRole={mode === "students" ? "student" : "agency"}
        onClose={() => setAuthModal((current) => ({ ...current, open: false }))}
      />
    </div>
  );
}

function HeroSection({
  onOpenAuth,
}: {
  onOpenAuth: (mode: "login" | "signup") => void;
}) {
  const t = useT();
  const features = [
    { icon: <ClockIcon />, title: t.landing.features.saveTime, description: t.landing.features.saveTimeDesc },
    { icon: <ShieldIcon />, title: t.landing.features.fewerErrors, description: t.landing.features.fewerErrorsDesc },
    { icon: <DocumentIcon />, title: t.landing.features.applyMore, description: t.landing.features.applyMoreDesc },
  ];

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
      <div>
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          {t.landing.hero.badge}
        </span>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          {t.landing.hero.titleLine1}
          <br />
          <span className="text-blue-600">{t.landing.hero.titleLine2}</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-slate-500">
          {t.landing.hero.description}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenAuth("signup")}
            className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm"
          >
            {t.landing.hero.ctaPrimary}
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 text-sm font-semibold text-slate-700"
          >
            <PlayIcon />
            {t.landing.hero.ctaSecondary}
          </button>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
          {features.map((feature) => (
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
              {t.landing.hero.profileCardTitle}
            </h2>
            <ul className="mt-4 flex flex-col gap-3.5">
              {t.landing.hero.profileSteps.map((step) => (
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
                {t.landing.hero.dataSecure}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
            <h2 className="text-sm font-semibold text-slate-950">
              {t.landing.hero.applyCardTitle}
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
                    {t.landing.hero[
                      `status${target.status.charAt(0).toUpperCase()}${target.status.slice(1)}` as
                        | "statusSubmitted"
                        | "statusInProgress"
                        | "statusReady"
                        | "statusDraft"
                    ]}
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
                  {t.landing.hero.moreUniversitiesTitle}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {t.landing.hero.moreUniversitiesDesc}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgencyHeroSection() {
  const t = useT();

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
      <div>
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          {t.landing.agency.badge}
        </span>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          {t.landing.agency.titleLine1}
          <br />
          <span className="text-blue-600">{t.landing.agency.titleLine2}</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-slate-500">
          {t.landing.agency.description}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm"
          >
            {t.landing.agency.ctaPrimary}
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 text-sm font-semibold text-slate-700"
          >
            <DownloadIcon />
            {t.landing.agency.ctaSecondary}
          </button>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
          <AgencyTrustBullet icon={<BankIcon />} label={t.landing.agency.trustBullet1} />
          <AgencyTrustBullet icon={<ShieldIcon />} label={t.landing.agency.trustBullet2} />
          <AgencyTrustBullet icon={<LockIcon />} label={t.landing.agency.trustBullet3} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
              AP
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">
                Anna Petrova
              </div>
              <div className="truncate text-xs text-slate-400">
                anna.petrova@email.com
              </div>
            </div>
          </div>

          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <CheckIcon /> 12 documents
          </span>

          <ul className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
            {t.landing.agency.profileSections.map((section, index) => (
              <li
                key={section}
                className={`text-sm ${
                  index === t.landing.agency.profileSections.length - 1
                    ? "font-semibold text-blue-600"
                    : "text-slate-600"
                }`}
              >
                {section}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
          <h2 className="text-sm font-semibold text-slate-950">
            {t.landing.agency.manualProcessTitle}
          </h2>
          <ol className="mt-4 flex flex-col gap-3">
            {t.landing.agency.manualSteps.map((step, index) => (
              <li key={step} className="flex items-center gap-2.5 text-sm text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[11px] font-semibold text-rose-600">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-rose-50 p-3">
            <span className="text-rose-600">
              <ClockIcon />
            </span>
            <div>
              <div className="text-sm font-semibold text-rose-700">{t.landing.agency.manualHours}</div>
              <div className="text-xs text-rose-600">{t.landing.agency.perStudent}</div>
            </div>
          </div>

          <h2 className="mt-5 text-sm font-semibold text-emerald-700">
            {t.landing.agency.withLotsApplyTitle}
          </h2>
          <div className="mt-4 flex items-center justify-between gap-2">
            {[<UploadIcon key="upload" />, <BankIcon key="bank" />, <PaperPlaneIcon key="plane" size={16} />].map(
              (icon, index) => (
                <div key={t.landing.agency.autoSteps[index]} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      {icon}
                    </span>
                    <span className="text-[11px] text-slate-500">{t.landing.agency.autoSteps[index]}</span>
                  </div>
                  {index < t.landing.agency.autoSteps.length - 1 ? (
                    <span className="mb-4 text-slate-300">
                      <ArrowRightIcon />
                    </span>
                  ) : null}
                </div>
              ),
            )}
          </div>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 p-3">
            <span className="text-emerald-600">
              <ClockIcon />
            </span>
            <div>
              <div className="text-sm font-semibold text-emerald-700">{t.landing.agency.autoSetupTime}</div>
              <div className="text-xs text-emerald-600">{t.landing.agency.setupLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgencyTrustBullet({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-blue-600">{icon}</span>
      <div className="max-w-36 text-xs font-medium text-slate-600">{label}</div>
    </div>
  );
}

function TrustedByAgenciesSection() {
  const t = useT();

  return (
    <section className="border-t border-slate-100 bg-slate-50/60">
      <div className="mx-auto w-full max-w-7xl px-6 py-14">
        <p className="text-center text-xs font-semibold tracking-wide text-slate-400">
          {t.landing.agency.trustedByHeading}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {AGENCY_TRUST_LOGOS.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center rounded-xl bg-white p-4 text-center text-xs font-semibold text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-black/5"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AgencyStatsSection() {
  const t = useT();
  const stats = [
    { icon: <ClockIcon />, title: t.landing.agency.statsSaveTime, description: t.landing.agency.statsSaveTimeDesc },
    { icon: <DocumentIcon />, title: t.landing.agency.statsConsistent, description: t.landing.agency.statsConsistentDesc },
    { icon: <ChartIcon />, title: t.landing.agency.statsScale, description: t.landing.agency.statsScaleDesc },
    { icon: <GridIcon />, title: t.landing.agency.statsTrack, description: t.landing.agency.statsTrackDesc },
  ];

  return (
    <section className="border-t border-slate-100">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.title} className="flex flex-col gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              {stat.icon}
            </span>
            <div className="text-sm font-semibold text-slate-950">{stat.title}</div>
            <p className="text-xs leading-5 text-slate-500">{stat.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SupportedUniversitiesSection() {
  const t = useT();

  return (
    <section id="universities" className="border-t border-slate-100 bg-slate-50/60">
      <div className="mx-auto w-full max-w-7xl px-6 py-14">
        <p className="text-center text-xs font-semibold tracking-wide text-slate-400">
          {t.landing.universities.heading}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SUPPORTED_UNIVERSITIES.map((university) => (
            <a
              key={university.nameEn}
              href={university.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-black/5 transition hover:shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_20px_rgba(15,23,42,0.08)]"
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
            </a>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <span className="inline-flex select-none items-center gap-1.5 text-sm font-semibold text-blue-600">
            {t.landing.universities.viewAll}
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

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path
          d="M6 6l12 12M18 6 6 18"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      )}
    </svg>
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

function PaperPlaneIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15V4m0 0 4 4m-4-4-4 4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V10m7 10V4m7 16v-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
