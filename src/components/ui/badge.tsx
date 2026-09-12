import type { HTMLAttributes } from "react";

type Tone = "neutral" | "warning" | "success";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  warning:
    "border-warning/30 bg-warning/10 text-warning",
  success:
    "border-success/30 bg-success/10 text-success",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
