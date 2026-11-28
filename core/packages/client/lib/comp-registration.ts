import { wallPartsIn, dayDelta } from '@cuberoot/shared/tz';
// Registration instants are compared as epoch milliseconds; grouping uses the viewer's calendar.
import { apiUrl } from './api-base';
import type { Comp } from './comp-search';
import type { CubingRegistration } from '@cuberoot/shared/cubing-live';

export type RegKind = 'open' | 'close' | 'reopen' | 'closed' | 'unknown';
export type RegStatus = 'upcoming' | 'open' | 'reopened' | 'paused' | 'closed' | 'unknown';
export interface RegItem { comp: Comp; kind: RegKind; status: RegStatus; at: number }
export type RegBucketKey = 'today' | 'tomorrow' | 'dayAfter' | 'soon' | 'later' | 'closed' | 'unknown';
export interface RegBucket { key: RegBucketKey; items: RegItem[] }
export interface RegView { followed: RegItem[]; buckets: RegBucket[]; total: number }
export type CubingRegistrations = Readonly<Record<string, CubingRegistration>>;

export async function fetchCubingRegistrations(signal: AbortSignal): Promise<CubingRegistrations> {
  const res = await fetch(apiUrl('/v1/cubing-registration?v=1'), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!res.ok) throw new Error('registration source');
  const data = await res.json() as { registrations?: CubingRegistrations };
  if (!data.registrations || typeof data.registrations !== 'object' || Array.isArray(data.registrations)) {
    throw new Error('registration data');
  }
  return data.registrations;
}

const MS_DAY = 86_400_000;
export const REG_HORIZON_DAYS = 60;
const BUCKET_ORDER: RegBucketKey[] = ['today', 'tomorrow', 'dayAfter', 'soon', 'later', 'closed', 'unknown'];

/** Require an explicit offset: a UTC timestamp must never silently become browser wall time. */
function instant(value: string | null | undefined): number {
  return value && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;
}

export function isBeforeRegistrationOpen(opensAt: string | null | undefined, now: number): boolean {
  return instant(opensAt) > now;
}

/** Cubing's registration rules include an early pause after having filled, even after withdrawals.
 * Source: cubing.com competition status helper, verified 2026-11-15.
 * Unknown CN inputs are not represented as a confirmed open registration. */
export function nextRegMilestone(c: Comp, now: number, cn?: CubingRegistration): RegItem | null {
  const open = instant(cn ? cn.registrationStartTime : c.registration_open);
  const close = instant(cn ? cn.registrationEndTime : c.registration_close);
  const item = (kind: RegKind, status: RegStatus, at: number): RegItem => ({ comp: c, kind, status, at });
  if (cn?.tba) return item('unknown', 'unknown', now);
  if (Number.isFinite(open) && now < open) return item('open', 'upcoming', open);
  if (Number.isFinite(close) && now >= close) return item('closed', 'closed', close);
  if (cn) {
    const reopen = instant(cn.registrationReopenTime);
    const withdraw = instant(cn.cancellationEndTime);
    if (reopen > now && (cn.hasBeenFull || !(withdraw > now))) return item('reopen', 'paused', reopen);
    if (close > now) return item('close', reopen <= now ? 'reopened' : 'open', close);
  }
  if (close > now) return item('close', c.country.toLowerCase() === 'cn' ? 'unknown' : 'open', close);
  return null;
}

/** Calendar arithmetic avoids 23/25-hour days at daylight-saving transitions. */
export function localDayDiff(atMs: number, now: number, timeZone?: string): number {
  if (timeZone) return dayDelta(wallPartsIn(timeZone, new Date(now)), wallPartsIn(timeZone, new Date(atMs)));
  const day = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  return (day(atMs) - day(now)) / MS_DAY;
}
function bucketOf(diff: number): RegBucketKey {
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === 2) return 'dayAfter';
  if (diff <= 6) return 'soon';
  return 'later';
}

export function buildRegView(comps: Comp[], now: number, followed: ReadonlySet<string>, cn: CubingRegistrations = {}, timeZone?: string): RegView {
  const horizon = now + REG_HORIZON_DAYS * MS_DAY;
  const followedItems: RegItem[] = [];
  const byBucket = new Map<RegBucketKey, RegItem[]>();
  for (const c of comps) {
    // CN dates use Beijing. Elsewhere retain through the last possible local day;
    // longitude estimates cannot model political time zones or daylight-saving time.
    const today = new Date(now + (c.country.toLowerCase() === 'cn' ? 8 : -12) * 3600_000).toISOString().slice(0, 10);
    if ((c.end_date || c.start_date) < today) continue;
    const m = nextRegMilestone(c, now, cn[c.id]);
    if (!m || (!followed.has(c.id) && m.at > horizon)) continue;
    if (followed.has(c.id)) { followedItems.push(m); continue; }
    const key = m.kind === 'closed' ? 'closed' : m.kind === 'unknown' ? 'unknown' : bucketOf(localDayDiff(m.at, now, timeZone));
    const items = byBucket.get(key) ?? [];
    items.push(m);
    byBucket.set(key, items);
  }
  const compare = (a: RegItem, b: RegItem) => a.at - b.at || a.comp.id.localeCompare(b.comp.id);
  followedItems.sort((a, b) => Number(a.kind === 'closed') - Number(b.kind === 'closed') || compare(a, b));
  const buckets = BUCKET_ORDER.flatMap(key => {
    const items = byBucket.get(key);
    return items?.length ? [{ key, items: items.sort(compare) }] : [];
  });
  return { followed: followedItems, buckets, total: followedItems.length + buckets.reduce((n, b) => n + b.items.length, 0) };
}

/** Includes ended registration for competitions that have not ended. */
export function countActionableReg(comps: Comp[], now: number): number {
  return buildRegView(comps, now, new Set()).total;
}
