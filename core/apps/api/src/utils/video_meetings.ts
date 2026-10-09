import { randomUUID } from 'node:crypto';
import { query, withTransaction, type QueryRunner } from '../db/connection.js';
import { pickAvailableRoomCode } from './room_code.js';
import type { MeetingDraft, MeetingPlan } from '@cuberoot/shared/meeting';

export interface MeetingRow {
  id: string; code: string; title: string; start_ms: number | string; end_ms: number | string;
  tz: string; rrule: string; cancelled: boolean;
}
export function meetingJson(row: MeetingRow): MeetingPlan {
  return { id: row.id, code: row.code, title: row.title, start: Number(row.start_ms),
    end: Number(row.end_ms), tz: row.tz, rrule: row.rrule, cancelled: row.cancelled };
}

/** Serialize quick and scheduled allocation across API workers. */
export async function reserveMeetingCode(tx: QueryRunner, active: ReadonlySet<string>, permanent: boolean) {
  await tx('SELECT pg_advisory_xact_lock(274500252)');
  const rows = await tx<{ code: string }>('SELECT code FROM video_meet_codes WHERE expires_at IS NULL OR expires_at > ?', [Date.now()]);
  const occupied = new Set([...active, ...rows.map(row => row.code)]);
  const code = pickAvailableRoomCode(occupied);
  if (!code) return null;
  await tx(`INSERT INTO video_meet_codes(code, expires_at) VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
  [code, permanent ? null : Date.now() + 10 * 60 * 1000]);
  return code;
}

export async function createMeetingPlan(owner: string, draft: MeetingDraft, active: ReadonlySet<string>) {
  return withTransaction(async tx => {
    await tx('SELECT pg_advisory_xact_lock(274500252)');
    const [count] = await tx<{ n: number }>('SELECT COUNT(*)::int AS n FROM video_meetings WHERE owner_key = ?', [owner]);
    if ((count?.n ?? 0) >= 100) return null;
    const code = await reserveMeetingCode(tx, active, true);
    if (!code) return null;
    const [row] = await tx<MeetingRow>(`INSERT INTO video_meetings
      (id, owner_key, code, title, start_ms, end_ms, tz, rrule, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [randomUUID(), owner, code, draft.title, draft.start, draft.end, draft.tz, draft.rrule, Date.now()]);
    return meetingJson(row!);
  });
}

export async function listMeetingPlans(owner: string) {
  return (await query<MeetingRow>('SELECT * FROM video_meetings WHERE owner_key = ? ORDER BY start_ms', [owner])).map(meetingJson);
}
