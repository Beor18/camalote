export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-soft-pulse rounded-lg bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}
