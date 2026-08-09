import { isAxiosError } from "axios";
import { useT } from "@/lib/i18n/context";

export function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400"
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
      >
        <option value="" disabled hidden>
          {placeholder ?? t.profileWizard.shared.selectPlaceholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function YearField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        placeholder="e.g. 2020"
        min={1950}
        max={2100}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : undefined)
        }
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400"
      />
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

export function StepSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function StepActions({
  onBack,
  isSubmitting,
  continueLabel,
}: {
  onBack?: () => void;
  isSubmitting: boolean;
  continueLabel?: string;
}) {
  const t = useT();

  return (
    <div className="flex gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
        >
          {t.common.back}
        </button>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
      >
        {isSubmitting ? t.profileWizard.shared.saving : (continueLabel ?? t.common.continueLabel)}
      </button>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
      {message}
    </p>
  );
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (
    isAxiosError(error) &&
    typeof error.response?.data?.message === "string"
  ) {
    return error.response.data.message;
  }
  return fallback;
}
