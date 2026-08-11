export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 ${className}`}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-5 w-2/3" />
    </div>
  );
}
