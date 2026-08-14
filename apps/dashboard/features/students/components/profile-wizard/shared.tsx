import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { env } from "@/lib/env";
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

// <input type="date"> is always stored as ISO but DISPLAYED per the browser/OS locale — there's
// no reliable cross-browser way to force that display format. This masked text input always
// shows/types dd/mm/yyyy while still emitting ISO "YYYY-MM-DD" via onChange, so callers (and the
// passport-parse auto-fill) don't need to know the difference. Trade-off: no native calendar picker.
export function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(() => isoToDisplayDate(value));
  const [lastValue, setLastValue] = useState(value);

  // Render-time "adjust state when a prop changes" — keeps the typed text in sync when the ISO
  // value changes from outside (e.g. passport-parse auto-fill) without fighting the user's own
  // keystrokes the way a plain `value={isoToDisplayDate(value)}` controlled input would.
  if (value !== lastValue) {
    setLastValue(value);
    setDisplay(isoToDisplayDate(value));
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatDateDigits(event.target.value);
    setDisplay(formatted);

    const iso = formatted === "" ? "" : displayDateToIso(formatted);
    if (iso !== undefined) {
      setLastValue(iso);
      onChange(iso);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={display}
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        onChange={handleChange}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400"
      />
    </div>
  );
}

function formatDateDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

function displayDateToIso(display: string): string | undefined {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return undefined;
  }

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? undefined : iso;
}

function isoToDisplayDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function PhoneField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
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
      <PhoneInput
        value={value.replace(/^\+/, "")}
        onChange={(v) => onChange(`+${v}`)}
        placeholder={placeholder}
        inputClass="!h-10 !w-full !rounded-lg !border !border-slate-200 !text-sm !text-slate-800"
        buttonClass="!rounded-l-lg !border !border-slate-200"
        containerClass="!w-full"
      />
    </div>
  );
}

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  googleMapsPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=__initGoogleMapsAutocomplete`;
    script.async = true;
    (window as unknown as Record<string, () => void>).__initGoogleMapsAutocomplete = resolve;
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// Geocoded address search — degrades to a plain text input when no API key is configured.
export function AddressField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const apiKey = env.googleMapsApiKey;
    if (!apiKey || !inputRef.current) {
      return;
    }

    let autocomplete: google.maps.places.Autocomplete | undefined;
    let cancelled = false;

    loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !inputRef.current || !window.google) {
        return;
      }
      autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete!.getPlace();
        if (place.formatted_address) {
          onChangeRef.current(place.formatted_address);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400"
      />
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
