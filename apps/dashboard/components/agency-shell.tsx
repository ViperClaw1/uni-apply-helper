"use client";

import Link from "next/link";
import { Logo, LogoutButton, LanguageSwitcher } from "@/components/header";
import { useT } from "@/lib/i18n/context";

type NavTab =
  | "home"
  | "students"
  | "universities"
  | "applications"
  | "tasks"
  | "team"
  | "settings";

const NAV_ITEMS: { tab: NavTab; href: string; icon: () => React.ReactElement }[] = [
  { tab: "home", href: "/dashboard/home", icon: HomeIcon },
  { tab: "students", href: "/dashboard", icon: StudentsIcon },
  { tab: "universities", href: "/dashboard/universities", icon: UniversityIcon },
  { tab: "applications", href: "/dashboard/all-applications", icon: ApplicationsIcon },
  { tab: "tasks", href: "/dashboard/tasks", icon: TasksIcon },
  { tab: "team", href: "/dashboard/team", icon: TeamIcon },
  { tab: "settings", href: "/dashboard/settings", icon: SettingsIcon },
];

export function AgencyShell({
  active,
  companyName,
  children,
}: {
  active: NavTab;
  companyName?: string;
  children: React.ReactNode;
}) {
  const t = useT();

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-6">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Logo />
          <span className="truncate text-sm font-semibold text-slate-950">
            {companyName || t.header.brand}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ tab, href, icon: Icon }) => {
            const isActive = tab === active;

            return (
              <div key={tab}>
                {tab === "team" ? <div className="my-2 border-t border-slate-100" /> : null}
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <Icon />
                  {t.agencyShell.nav[tab]}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <LanguageSwitcher />
          <LogoutButton className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50" />
        </div>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}

export function ComingSoon() {
  const t = useT();

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6 py-8">
      <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t.agencyShell.comingSoon.title}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {t.agencyShell.comingSoon.description}
        </p>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m3 11 9-7 9 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M15.5 5.5c1.5.3 2.5 1.6 2.5 3s-1 2.7-2.5 3M18 14.3c1.9.5 3.3 2.2 3.3 4.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UniversityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m12 3 9 5-9 5-9-5 9-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ApplicationsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h6M9 16h6M9 8h2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="m8.5 12.5 2.3 2.3L16 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M2.5 20c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5M13 15.2c2.7.3 4.5 2.3 4.5 4.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 8.2 4.6l.1.1a1.7 1.7 0 0 0 1.9.3H10.4a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10.4a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
