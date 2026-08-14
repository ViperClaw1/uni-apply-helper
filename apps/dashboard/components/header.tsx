"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/features/auth/api/auth.api";
import { useLocale, useT } from "@/lib/i18n/context";

export function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
      L
    </span>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const isRu = locale === "ru";

  return (
    <div className="inline-flex items-center gap-2">
      <GlobeIcon className="shrink-0 text-slate-400" />
      <div className="relative inline-flex h-8 w-18 shrink-0 rounded-full bg-slate-100 p-1">
        <span
          aria-hidden
          className={`absolute left-1 top-1 h-6 w-8 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
            isRu ? "translate-x-8" : "translate-x-0"
          }`}
        />
        {(["en", "ru"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={locale === code}
            className={`relative z-10 w-8 cursor-pointer rounded-full text-[11px] font-semibold uppercase transition-colors active:scale-95 ${
              locale === code ? "text-slate-950" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {code}
          </button>
        ))}
      </div>
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoutButton({
  className,
  onClick,
  icon,
  title,
}: {
  className?: string;
  onClick?: () => void;
  /** Renders instead of the text label — for icon-only placements (e.g. a collapsed sidebar). */
  icon?: ReactNode;
  title?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    onClick?.();
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      title={title}
      className={
        className ??
        "inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-60"
      }
    >
      {icon ?? t.header.logOut}
    </button>
  );
}

type HeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  nav?: ReactNode;
  actions?: ReactNode;
  variant?: "site" | "page";
  /** Extra content rendered below the bar, e.g. a small-screen nav panel. Caller owns open/closed state. */
  mobileMenu?: ReactNode;
};

export function Header({ eyebrow, title, nav, actions, variant = "page", mobileMenu }: HeaderProps) {
  if (variant === "site") {
    return (
      <header className="border-b border-slate-100">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-semibold tracking-tight text-slate-950">{title}</span>
          </div>

          {nav}

          <div className="flex items-center gap-3">
            {actions}
            <LanguageSwitcher />
          </div>
        </div>

        {mobileMenu}
      </header>
    );
  }

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow ? <p className="text-sm font-medium text-slate-500">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
