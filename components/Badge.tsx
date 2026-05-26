import type { ReactNode } from "react";

type Tone = "brand" | "neutral" | "success" | "warning" | "muted" | "danger";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-dark",
  neutral: "bg-bg-soft text-ink-2",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  muted: "bg-line-soft text-ink-3",
  danger: "bg-red-50 text-red-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium " + TONES[tone]}>
      {children}
    </span>
  );
}
