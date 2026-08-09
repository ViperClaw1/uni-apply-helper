"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useT } from "@/lib/i18n/context";
import { login, signup, type AccountRole } from "../api/auth.api";
import { COUNTRIES, flagEmoji } from "../lib/countries";
import { isPasswordValid } from "../lib/password-policy";

type Mode = "login" | "signup";
type Phase = "form" | "submitting" | "check-email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthModalProps = {
  open: boolean;
  initialMode: Mode;
  initialRole: AccountRole;
  onClose: () => void;
};

const INITIAL_FIELDS = {
  email: "",
  password: "",
  confirmPassword: "",
  legalName: "",
  country: COUNTRIES[0]?.code ?? "",
  taxId: "",
};

export function AuthModal({ open, initialMode, initialRole, onClose }: AuthModalProps) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<AccountRole>(initialRole);
  const [step, setStep] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<Phase>("form");
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [error, setError] = useState<string | null>(null);

  // Reset all state whenever the modal transitions from closed to open —
  // done during render (React's "adjusting state on prop change" pattern),
  // not in an effect, so it applies before the first paint instead of after.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMode(initialMode);
      setRole(initialRole);
      setStep(1);
      setPhase("form");
      setFields(INITIAL_FIELDS);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && phase !== "submitting") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, phase, onClose]);

  if (!open) {
    return null;
  }

  const emailError =
    fields.email && !EMAIL_REGEX.test(fields.email) ? t.auth.errors.invalidEmail : null;
  const passwordError =
    fields.password && !isPasswordValid(fields.password) ? t.auth.errors.passwordPolicy : null;
  const confirmPasswordError =
    fields.confirmPassword && fields.confirmPassword !== fields.password
      ? t.auth.errors.passwordMismatch
      : null;

  function updateField<K extends keyof typeof INITIAL_FIELDS>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setStep(1);
    setPhase("form");
    setError(null);
  }

  function validateCredentialsStep(): string | null {
    if (!fields.email.trim()) {
      return t.auth.errors.emailRequired;
    }
    if (!isPasswordValid(fields.password)) {
      return t.auth.errors.passwordPolicy;
    }
    if (fields.password !== fields.confirmPassword) {
      return t.auth.errors.passwordMismatch;
    }
    return null;
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setPhase("submitting");
    setError(null);

    try {
      await login({ email: fields.email, password: fields.password });
      router.push("/dashboard");
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
      setPhase("form");
    }
  }

  function handleSignupStep1Submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateCredentialsStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (role === "agency") {
      setStep(2);
      return;
    }

    void submitSignup();
  }

  async function handleSignupStep2Submit(event: FormEvent) {
    event.preventDefault();

    if (!fields.legalName.trim() || !fields.taxId.trim()) {
      setError(t.auth.errors.legalNameRequired);
      return;
    }

    await submitSignup();
  }

  async function submitSignup() {
    setPhase("submitting");
    setError(null);

    try {
      const result = await signup({
        email: fields.email,
        password: fields.password,
        confirmPassword: fields.confirmPassword,
        role,
        agency:
          role === "agency"
            ? {
                legalName: fields.legalName,
                country: fields.country,
                taxId: fields.taxId,
              }
            : undefined,
      });

      // Verification is temporarily not required — `account` present means
      // the API already logged us in. Once it's required again, the API
      // stops returning `account` here and this falls back to "check email".
      if (result.account) {
        router.push("/dashboard");
      } else {
        setPhase("check-email");
      }
    } catch (submitError) {
      setError(extractErrorMessage(submitError, t.common.somethingWentWrong));
      setPhase("form");
    }
  }

  const isSubmitting = phase === "submitting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t.common.close}
        disabled={isSubmitting}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)] ring-1 ring-black/5"
      >
        {phase === "check-email" ? (
          <CheckEmailPanel email={fields.email} onClose={onClose} />
        ) : (
          <>
            <h2 id="auth-modal-title" className="text-lg font-semibold tracking-tight text-slate-950">
              {mode === "login" ? t.auth.logInTitle : t.auth.createAccountTitle}
            </h2>

            {mode === "signup" ? (
              <RoleTabs
                role={role}
                disabled={step === 2 || isSubmitting}
                onChange={setRole}
              />
            ) : null}

            {error ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            ) : null}

            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="mt-4 flex flex-col gap-3">
                <Field label={t.auth.email} type="email" placeholder={t.auth.emailPlaceholder} value={fields.email} onChange={(v) => updateField("email", v)} error={emailError} required />
                <Field label={t.auth.password} type="password" placeholder={t.auth.passwordPlaceholderLogin} value={fields.password} onChange={(v) => updateField("password", v)} required />
                <SubmitButton isSubmitting={isSubmitting} label={t.auth.logInTitle} />
              </form>
            ) : step === 1 ? (
              <form onSubmit={handleSignupStep1Submit} className="mt-4 flex flex-col gap-3">
                <Field label={t.auth.email} type="email" placeholder={t.auth.emailPlaceholder} value={fields.email} onChange={(v) => updateField("email", v)} error={emailError} required />
                <Field label={t.auth.password} type="password" placeholder={t.auth.passwordPlaceholderSignup} value={fields.password} onChange={(v) => updateField("password", v)} error={passwordError} required />
                <Field label={t.auth.confirmPassword} type="password" placeholder={t.auth.confirmPasswordPlaceholder} value={fields.confirmPassword} onChange={(v) => updateField("confirmPassword", v)} error={confirmPasswordError} required />
                <p className="text-xs text-slate-400">{t.auth.errors.passwordPolicy}</p>
                <SubmitButton isSubmitting={isSubmitting} label={role === "agency" ? t.auth.continueButton : t.auth.createAccountButton} />
              </form>
            ) : (
              <form onSubmit={handleSignupStep2Submit} className="mt-4 flex flex-col gap-3">
                <Field label={t.auth.agencyLegalName} placeholder={t.auth.agencyLegalNamePlaceholder} value={fields.legalName} onChange={(v) => updateField("legalName", v)} required />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t.auth.businessCountry}</label>
                  <select
                    value={fields.country}
                    onChange={(event) => updateField("country", event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {flagEmoji(country.code)} {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label={t.auth.taxId} placeholder={t.auth.taxIdPlaceholder} value={fields.taxId} onChange={(v) => updateField("taxId", v)} required />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setStep(1)}
                    className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {t.common.back}
                  </button>
                  <SubmitButton isSubmitting={isSubmitting} label={t.auth.createAccountButton} className="flex-1" />
                </div>
              </form>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              {mode === "login" ? (
                <>
                  {t.auth.dontHaveAccount}{" "}
                  <button type="button" onClick={() => switchMode("signup")} className="cursor-pointer font-semibold text-blue-600">
                    {t.auth.signUp}
                  </button>
                </>
              ) : (
                <>
                  {t.auth.alreadyHaveAccount}{" "}
                  <button type="button" onClick={() => switchMode("login")} className="cursor-pointer font-semibold text-blue-600">
                    {t.auth.logInTitle}
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function RoleTabs({
  role,
  disabled,
  onChange,
}: {
  role: AccountRole;
  disabled: boolean;
  onChange: (role: AccountRole) => void;
}) {
  const t = useT();

  return (
    <div className="mt-3 flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
      {(["student", "agency"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`flex-1 cursor-pointer rounded-lg py-1.5 capitalize transition disabled:cursor-not-allowed ${
            role === option ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
          }`}
        >
          {option === "student" ? t.auth.student : t.auth.agency}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  error,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 rounded-lg border px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 ${
          error ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-blue-400"
        }`}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function SubmitButton({
  isSubmitting,
  label,
  className = "",
}: {
  isSubmitting: boolean;
  label: string;
  className?: string;
}) {
  const t = useT();

  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-60 ${className}`}
    >
      {isSubmitting ? t.auth.pleaseWait : label}
    </button>
  );
}

function CheckEmailPanel({ email, onClose }: { email: string; onClose: () => void }) {
  const t = useT();

  return (
    <div className="text-center">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">{t.auth.checkEmailTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {t.auth.checkEmailDescPrefix}<span className="font-medium text-slate-800">{email}</span>{t.auth.checkEmailDescSuffix}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
      >
        {t.auth.gotIt}
      </button>
    </div>
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.message === "string") {
    return error.response.data.message;
  }
  return fallback;
}
