import { localDateTimeToIso, teachingDateTimeLabel } from "./teaching-stage2";

export type TeachingEffectiveState = "active" | "upcoming" | "ended";

export function resolveTeachingEffectiveRange(
  localFrom: string,
  localTo: string,
  timezone: string,
  now = new Date(),
): { effectiveFrom: string; effectiveTo?: string } | null {
  const effectiveFrom = localFrom
    ? localDateTimeToIso(localFrom, timezone)
    : now.toISOString();
  const effectiveTo = localTo ? localDateTimeToIso(localTo, timezone) : null;
  if (!effectiveFrom || (localTo && !effectiveTo)) return null;
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) return null;
  return effectiveTo ? { effectiveFrom, effectiveTo } : { effectiveFrom };
}

export function teachingEffectiveState(
  effectiveFrom: string,
  effectiveTo: string | null,
  nowMs = Date.now(),
): TeachingEffectiveState {
  if (effectiveTo === effectiveFrom) return "ended";
  if (nowMs < Date.parse(effectiveFrom)) return "upcoming";
  if (effectiveTo !== null && nowMs >= Date.parse(effectiveTo)) return "ended";
  return "active";
}

export function teachingEffectiveStateLabel(state: TeachingEffectiveState): string {
  if (state === "upcoming") return "待生效";
  if (state === "ended") return "已结束";
  return "生效中";
}

export function teachingEffectiveRangeLabel(
  effectiveFrom: string,
  effectiveTo: string | null,
  timezone: string,
): string {
  const from = teachingDateTimeLabel(effectiveFrom, timezone);
  if (effectiveTo === null) return `${from} 起，长期有效`;
  return `${from} 起，${teachingDateTimeLabel(effectiveTo, timezone)} 前`;
}
