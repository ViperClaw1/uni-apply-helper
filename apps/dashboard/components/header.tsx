"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n/context";

export function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
      L
    </span>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
      {(["en", "ru"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`cursor-pointer rounded-md px-2 py-1 uppercase transition-colors ${
            locale === code
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
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
