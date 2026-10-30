import { dateKey, dayDelta, parseDateTime, timeKey, wallPartsIn, wallToUtc, zoneOffsetMinutes, type WallParts } from '@cuberoot/shared/tz';

/** Minutes on a local wall-clock week, not elapsed UTC minutes. */
export interface AvailabilityRange { start: number; end: number }
const DAY = 1440;
export const WEEK = DAY * 7;

export function shiftDate(date: string, days: number): string {
  const p = parseDateTime(date, '00:00');
  if (!p) return '';
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d + days));
  return dateKey({ y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

export function weekOf(date: string): string | null {
  const p = parseDateTime(date, '00:00');
  if (!p || p.y < 100 || shiftDate(date, 0) !== date) return null;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

export function mergeRanges(ranges: AvailabilityRange[]): AvailabilityRange[] {
  const sorted = ranges.filter(({ start, end }) => Number.isInteger(start) && Number.isInteger(end)
    && start >= 0 && start < WEEK && end <= WEEK + DAY && end > start).sort((a, b) => a.start - b.start);
  const out: AvailabilityRange[] = [];
  for (const r of sorted) {
    const previous = out.at(-1);
    if (previous && r.start <= previous.end) previous.end = Math.max(previous.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

export function readRanges(raw: string): AvailabilityRange[] {
  return mergeRanges(raw.split(',').slice(0, 100).flatMap((part) => {
    const match = /^(\d+)-(\d+)$/.exec(part);
    return match ? [{ start: Number(match[1]), end: Number(match[2]) }] : [];
  }));
}

export function writeRanges(ranges: AvailabilityRange[]): string {
  return mergeRanges(ranges).map(({ start, end }) => `${start}-${end}`).join(',');
}

export function wallAt(week: string, minute: number): WallParts {
  return parseDateTime(shiftDate(week, Math.floor(minute / DAY)),
    timeKey({ h: Math.floor(minute % DAY / 60), mi: minute % 60 }))!;
}

export function weekMinute(week: string, zone: string, at: Date): number {
  const p = wallPartsIn(zone, at);
  return dayDelta(parseDateTime(week, '00:00')!, p) * DAY + p.h * 60 + p.mi;
}

function resolveEndpoint(zone: string, wall: WallParts): Date | null {
  const at = wallToUtc(zone, wall);
  const sameWall = (d: Date) => {
    const p = wallPartsIn(zone, d);
    return dateKey(p) === dateKey(wall) && timeKey(p) === timeKey(wall);
  };
  // A skipped hour must not silently turn into a different appointment time.
  if (!sameWall(at)) return null;
  // Reject repeated wall times rather than silently picking one side of a clock change.
  const offset = zoneOffsetMinutes(zone, at);
  for (const days of [-2, 2]) {
    const other = zoneOffsetMinutes(zone, new Date(at.getTime() + days * 86_400_000));
    const candidate = new Date(at.getTime() + (offset - other) * 60_000);
    if (other !== offset && sameWall(candidate)) return null;
  }
  return at;
}

export function resolveRange(week: string, zone: string, range: AvailabilityRange) {
  const start = resolveEndpoint(zone, wallAt(week, range.start));
  const end = resolveEndpoint(zone, wallAt(week, range.end));
  return start && end && end > start ? { start, end } : null;
}
