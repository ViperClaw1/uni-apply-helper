export function PhotoAvatar({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-black/5"
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500 ring-1 ring-black/5">
      {initial}
    </span>
  );
}
