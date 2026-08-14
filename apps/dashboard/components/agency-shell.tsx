"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, LogoutButton, LanguageSwitcher } from "@/components/header";
import { useT } from "@/lib/i18n/context";

const COLLAPSED_STORAGE_KEY = "agency-sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(false);

  // Each dashboard page mounts its own <AgencyShell> (no persistent layout wraps them), so the
  // preference is read from localStorage on mount rather than lifted to a shared layout/context —
  // otherwise it'd silently reset to expanded on every nav click. This has to run post-mount:
  // `window` doesn't exist during SSR, so reading it during render would either crash on the
  // server or desync from the server-rendered (always "expanded") HTML and trip a hydration
  // mismatch — an effect deliberately trades that for one harmless expanded-then-collapsed flash.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside
        className={`sticky top-0 relative flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white py-6 transition-[width] duration-200 ${
          collapsed ? "w-[76px] px-2" : "w-60 px-3"
        }`}
      >
        <div className={`mb-6 flex items-center gap-2 px-2 ${collapsed ? "justify-center" : ""}`}>
          <Logo />
          {!collapsed ? (
            <span className="truncate text-sm font-semibold text-slate-950">
              {companyName || t.header.brand}
            </span>
          ) : null}
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ tab, href, icon: Icon }) => {
            const isActive = tab === active;

            return (
              <div key={tab}>
                {tab === "team" ? <div className="my-2 border-t border-slate-100" /> : null}
                <Link
                  href={href}
                  title={collapsed ? t.agencyShell.nav[tab] : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center px-0" : ""
                  } ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <Icon />
                  {!collapsed ? t.agencyShell.nav[tab] : null}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          {!collapsed ? <LanguageSwitcher /> : null}
          <LogoutButton
            title={collapsed ? t.header.logOut : undefined}
            icon={collapsed ? <LogoutIcon /> : undefined}
            className={
              collapsed
                ? "inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                : "inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            }
          />
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? t.agencyShell.expandSidebar : t.agencyShell.collapseSidebar}
          className="absolute -right-3 top-8 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
    >
      <path
        d="m15 6-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 15.5 20 12l-4-3.5M20 12H9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
