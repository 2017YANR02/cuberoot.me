import { isValidZone } from './tz';
import { expandOccurrences, formatRRule, parseRRule } from './recur';

export interface MeetingDraft {
  title: string;
  start: number;
  end: number;
  tz: string;
  rrule: string;
}
export interface MeetingPlan extends MeetingDraft {
  id: string;
  code: string;
  cancelled: boolean;
}

/** Reuse the calendar engine so weekly meetings retain their wall time across DST. */
export function meetingOccurrences(plan: MeetingPlan, from: number, to: number) {
  if (plan.cancelled) return [];
  return expandOccurrences({
    rrule: plan.rrule, start: plan.start, tz: plan.tz,
    durationMs: plan.end - plan.start, from, to,
  }).map(start => ({ plan, start, end: start + plan.end - plan.start }));
}

export function validateMeetingDraft(value: unknown): MeetingDraft | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<MeetingDraft>;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.trim().length > 120 ||
      typeof v.start !== 'number' || typeof v.end !== 'number' ||
      !Number.isSafeInteger(v.start) || !Number.isSafeInteger(v.end) ||
      v.start % 60000 !== 0 || v.end % 60000 !== 0 ||
      v.start < 946684800000 || v.end <= v.start || v.end - v.start > 86_400_000 ||
      v.end > 4133980800000 || typeof v.tz !== 'string' || v.tz.length > 100 || !isValidZone(v.tz) ||
      typeof v.rrule !== 'string' || v.rrule.length > 500) return null;
  const rule = v.rrule ? parseRRule(v.rrule) : null;
  if (rule && formatRRule(rule) !== v.rrule) return null;
  if (v.rrule && (!rule || !Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365 ||
      !Number.isInteger(rule.count) || rule.count < 0 || rule.count > 1000 ||
      (rule.until > 0 && rule.until < v.start))) return null;
  return { title: v.title.trim(), start: v.start, end: v.end, tz: v.tz, rrule: rule ? formatRRule(rule) : '' };
}
