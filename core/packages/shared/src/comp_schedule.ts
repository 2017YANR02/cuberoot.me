// Pure WCIF → trimmed-schedule transform, shared by client (fallback trim),
// server (on-view write-through) and the backfill script. Keeping ONE copy
// guarantees the cached ScheduleData shape is bit-identical across all three.
// No DOM / Intl / i18n here — those stay in the client render layer.

// ── WCIF raw shapes we read (partial; only fields we trim) ──────────
export interface RawActivity {
  id: number;
  name: string;
  activityCode: string;
  startTime: string;   // UTC ISO with Z
  endTime: string;
  childActivities?: RawActivity[];
}
export interface RawRoom { id: number; name: string; color: string; activities?: RawActivity[]; }
export interface RawVenue {
  id: number; name: string; timezone: string;
  latitudeMicrodegrees?: number; longitudeMicrodegrees?: number;
  countryIso2?: string; rooms?: RawRoom[];
}
export interface RawRound {
  id: string;
  format: string;
  timeLimit: { centiseconds: number; cumulativeRoundIds: string[] } | null;
  cutoff: { numberOfAttempts: number; attemptResult: number } | null;
  advancementCondition: { type: 'ranking' | 'percent' | 'attemptResult'; level: number } | null;
}
export interface RawWcif {
  schedule?: { startDate: string; numberOfDays: number; venues?: RawVenue[] };
  events?: { id: string; rounds?: RawRound[] }[];
}

// ── Trimmed / cached shapes (this is what we persist) ───────────────
export interface ScheduleActivity {
  id: number;
  name: string;
  activityCode: string;
  startTime: string;   // UTC ISO
  endTime: string;
  roomId: number;
  roomName: string;
  roomColor: string;   // hex e.g. "#800080"
}
export interface ScheduleRoom { id: number; name: string; color: string; }
export interface ScheduleVenue {
  id: number; name: string; timezone: string;
  countryIso2: string;
  rooms: ScheduleRoom[];
}
export interface RoundInfo {
  id: string;                 // "333-r1"
  eventId: string;            // "333"
  roundNumber: number;        // 1-based
  totalRounds: number;        // # rounds for this event (for getRoundTypeId)
  format: string;             // 'a'|'m'|'1'|'2'|'3'|'5'|'h' (head-to-head)
  timeLimit: { centiseconds: number; cumulativeRoundIds: string[] } | null;
  cutoff: { numberOfAttempts: number; attemptResult: number } | null;
  advancementCondition: { type: 'ranking' | 'percent' | 'attemptResult'; level: number } | null;
}
export interface ScheduleData {
  startDate: string;          // "2025-07-03"
  numberOfDays: number;
  venues: ScheduleVenue[];
  activities: ScheduleActivity[]; // flattened top-level activities
  groupActivities?: ScheduleActivity[]; // absent in older cached schedules
  rounds: Record<string, RoundInfo>; // by round id
}

// activityCode parser (port of WCA parseActivityCode; tolerant — no throw)
export function parseActivityCode(code: string): {
  eventId: string; roundNumber?: number; group?: string; attempt?: number;
} {
  const out: { eventId: string; roundNumber?: number; group?: string; attempt?: number } = { eventId: '' };
  if (!code) return out;
  const [eventId, ...rest] = code.split('-');
  out.eventId = eventId;
  for (const part of rest) {
    const value = part.slice(1);
    switch (part[0]) {
      case 'r': { const n = parseInt(value, 10); if (!Number.isNaN(n)) out.roundNumber = n; break; }
      case 'g': out.group = value; break;
      case 'a': { const n = parseInt(value, 10); if (!Number.isNaN(n)) out.attempt = n; break; }
      default: break; // tolerant: ignore unknown parts
    }
  }
  return out;
}

/** A timed group slot, without an attempt or a personal assignment. */
export const isScheduleGroupCode = (code: string) =>
  /^[a-z0-9]+-r[1-9]\d*-g[A-Za-z0-9]{1,16}$/.test(code);

/**
 * Pure: RawWcif → ScheduleData | null (null if no schedule node at all).
 * `null` is the "no schedule available" signal — callers tombstone it so the
 * 10MB WCIF is not re-fetched on every view.
 */
export function trimWcif(raw: RawWcif): ScheduleData | null {
  const sched = raw.schedule;
  if (!sched) return null;

  // rounds map (compute roundNumber + totalRounds per event)
  const rounds: Record<string, RoundInfo> = {};
  for (const e of raw.events ?? []) {
    const evRounds = e.rounds ?? [];
    const total = evRounds.length;
    evRounds.forEach((r, idx) => {
      const parsed = parseActivityCode(r.id);
      rounds[r.id] = {
        id: r.id,
        eventId: parsed.eventId || e.id,
        roundNumber: parsed.roundNumber ?? (idx + 1),
        totalRounds: total,
        format: r.format,
        timeLimit: r.timeLimit ?? null,
        cutoff: r.cutoff ?? null,
        advancementCondition: r.advancementCondition ?? null,
      };
    });
  }

  const venues: ScheduleVenue[] = [];
  const activities: ScheduleActivity[] = [];
  const groupActivities: ScheduleActivity[] = [];
  for (const v of sched.venues ?? []) {
    venues.push({
      id: v.id,
      name: v.name,
      timezone: v.timezone,
      countryIso2: v.countryIso2 ?? '',
      rooms: (v.rooms ?? []).map(r => ({ id: r.id, name: r.name, color: r.color })),
    });
    for (const room of v.rooms ?? []) {
      const trimActivity = (activity: RawActivity): ScheduleActivity => ({
        id: activity.id, name: activity.name, activityCode: activity.activityCode,
        startTime: activity.startTime, endTime: activity.endTime,
        roomId: room.id, roomName: room.name, roomColor: room.color,
      });
      for (const a of room.activities ?? []) {
        activities.push(trimActivity(a));
        const pending = [a];
        while (pending.length) {
          const activity = pending.pop()!;
          if (isScheduleGroupCode(activity.activityCode)) groupActivities.push(trimActivity(activity));
          for (const child of activity.childActivities ?? []) pending.push(child);
        }
      }
    }
  }

  return {
    startDate: sched.startDate,
    numberOfDays: sched.numberOfDays,
    venues,
    activities,
    groupActivities,
    rounds,
  };
}
