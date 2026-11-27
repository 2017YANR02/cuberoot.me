import {
  COMPETITION_OBSERVATION_WINDOW_MS, COMPETITION_INTERMISSION_MS, COMPETITION_START_BUFFER_MS, COMPETITION_STAGE_LIMIT_MS,
  competitionDeadline, competitionSolveStart, type CompetitionDnfReason,
} from '@cuberoot/shared/timer';
import { platformQuery, type PlatformDb } from './db.js';
import { conflict, forbidden, notFound } from './errors.js';
import { competitionScramble } from './competition_workflow.js';
import { finishCompetitionSelfAttempt } from './competitions.js';

export const COMPETITION_DNF = { centiseconds: null, penalty: 'DNF' } as const;

type Project = Parameters<typeof competitionScramble>[0];
type Entry = {
  id: string; user_id: number; session_id: string; project: Project; device: string;
  in_window: boolean; status: string; checked: boolean; kind: string; format: string | null;
};
type Round = { id: string; session_id: string; project: Project; device: string; number: number; starts_at: Date; completed_at: Date | null };

export async function arenaEntry(db: PlatformDb, id: string, userId: number | null, allowPendingCheckIn = false) {
  const [entry] = await platformQuery<Entry>(db, `SELECT r.id::text,r.user_id,s.id::text AS session_id,
    r.competition_project AS project,t.competition_device AS device,s.session_kind AS kind,c.competition_format AS format,
    r.status,r.checked_in_at IS NOT NULL AS checked,
    (e.status='published' AND s.starts_at<=clock_timestamp() AND s.ends_at>clock_timestamp()) AS in_window
    FROM platform_event_registrations r JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_competitions c ON c.event_id=r.event_id JOIN platform_events e ON e.id=r.event_id
    WHERE r.id=$1::uuid`, [id]);
  if (!entry) notFound('Competition entry');
  if (userId == null || Number(entry.user_id) !== userId) forbidden('Only the participant can open this seat');
  const pendingCheckIn = allowPendingCheckIn && entry.device === 'smart' && entry.status === 'confirmed' && entry.in_window;
  if (!['confirmed', 'attended'].includes(entry.status) || (!entry.checked && !pendingCheckIn) || entry.kind === 'offline' || entry.format === 'advancement') {
    conflict('A checked-in online Ao5 entry is required');
  }
  return entry;
}

export async function lockArenaRound(db: PlatformDb, entry: Pick<Entry, 'session_id' | 'project' | 'device'>) {
  const [round] = await platformQuery<Round>(db, `SELECT id::text,session_id::text,project,device,number,starts_at,completed_at
    FROM platform_competition_arena_rounds WHERE session_id=$1::uuid AND project=$2 AND device=$3 FOR UPDATE`,
  [entry.session_id, entry.project, entry.device]);
  return round;
}

// The caller holds the round row lock, so admission and round advancement see the same field.
async function admitCompetitionArenaEntry(db: PlatformDb, round: Round, entry: Entry) {
  if (round.completed_at || !entry.in_window || entry.status !== 'confirmed') return;
  await platformQuery(db, `WITH entrant AS (
    SELECT r.id FROM platform_event_registrations r
    WHERE r.id=$1::uuid AND r.status='confirmed' AND r.checked_in_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM platform_competition_attempts a
        WHERE a.registration_id=r.id AND (a.arena_round_id IS DISTINCT FROM $2::uuid OR a.attempt_number=$3)
      )
    FOR UPDATE OF r
  )
  INSERT INTO platform_competition_attempts AS existing (registration_id,attempt_number,scramble,issued_at,arena_round_id,penalty,recorded_at)
  SELECT entrant.id,n,CASE WHEN n=ar.number THEN ar.scramble ELSE '' END,
    CASE WHEN n=ar.number THEN ar.starts_at ELSE LEAST(ar.starts_at,clock_timestamp()) END,
    ar.id,CASE WHEN n<ar.number THEN 'DNF' END,CASE WHEN n<ar.number THEN clock_timestamp() END
  FROM entrant CROSS JOIN platform_competition_arena_rounds ar
  CROSS JOIN LATERAL generate_series(1,ar.number) AS attempts(n)
  WHERE ar.id=$2::uuid
  ON CONFLICT (registration_id,attempt_number) DO UPDATE SET penalty=EXCLUDED.penalty,recorded_at=EXCLUDED.recorded_at
  WHERE existing.arena_round_id=EXCLUDED.arena_round_id AND existing.recorded_at IS NULL AND EXCLUDED.penalty='DNF'`,
  [entry.id, round.id, round.number]);
}

export async function startCompetitionArena(db: PlatformDb, entry: Entry) {
  await platformQuery(db, 'SELECT id FROM platform_competition_sessions WHERE id=$1::uuid FOR UPDATE', [entry.session_id]);
  const existing = await lockArenaRound(db, entry);
  if (existing) {
    await admitCompetitionArenaEntry(db, existing, entry);
    await advanceCompetitionArena(db, existing);
    return existing.id;
  }
  if (!entry.in_window || entry.status !== 'confirmed') conflict('The session is closed');
  const [alreadyIssued] = await platformQuery(db, 'SELECT 1 FROM platform_competition_attempts WHERE registration_id=$1::uuid', [entry.id]);
  if (alreadyIssued) conflict('This seat has an attempt from an earlier session format');
  const scramble = await competitionScramble(entry.project);
  const [round] = await platformQuery<Round>(db, `INSERT INTO platform_competition_arena_rounds(session_id,project,device,number,scramble,starts_at)
    VALUES($1::uuid,$2,$3,1,$4,clock_timestamp()+$5*INTERVAL '1 millisecond')
    RETURNING id,starts_at`, [entry.session_id, entry.project, entry.device, scramble, COMPETITION_START_BUFFER_MS]);
  // Seed only checked-in entrants. The locked arena can admit later check-ins.
  await platformQuery(db, `INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble,issued_at,arena_round_id)
    SELECT r.id,1,$4,$5,$6::uuid FROM platform_event_registrations r
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    WHERE r.competition_session_id=$1::uuid AND r.competition_project=$2 AND t.competition_device=$3 AND r.status='confirmed' AND r.checked_in_at IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM platform_competition_attempts old WHERE old.registration_id=r.id)`,
  [entry.session_id, entry.project, entry.device, scramble, round.starts_at, round.id]);
  return round.id;
}

export async function recordArenaDnf(db: PlatformDb, id: string, number: number, reason: CompetitionDnfReason) {
  await platformQuery(db, `UPDATE platform_competition_attempts SET dnf_reason=$3
    WHERE registration_id=$1::uuid AND attempt_number=$2 AND recorded_at IS NULL`, [id, number, reason]);
  await finishCompetitionSelfAttempt(db, id, number, null, COMPETITION_DNF, false);
}

export const ORDINARY_ARENA_OBSERVATION_WINDOW_MS = 16_000;

function arenaObservationWindow(smart: boolean) {
  return smart ? COMPETITION_OBSERVATION_WINDOW_MS : ORDINARY_ARENA_OBSERVATION_WINDOW_MS;
}

export function arenaDnfReason(issued: Date, inspected: Date | null, solved: Date | null, now: Date, smart = true): CompetitionDnfReason | null {
  if (+now < competitionDeadline(+issued, inspected?.getTime(), solved?.getTime(), arenaObservationWindow(smart))) return null;
  return inspected ? 'solve_timeout' : 'scramble_timeout';
}

export function arenaSolveAt(inspectAt: Date, now: Date, inspectionMs?: number, smart = true) {
  return new Date(competitionSolveStart(+inspectAt, inspectionMs === undefined ? +now : +inspectAt + inspectionMs, arenaObservationWindow(smart)));
}

export async function advanceCompetitionArena(db: PlatformDb, round: Round) {
  if (round.completed_at) return;
  const [clock] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
  if (round.starts_at > clock.now) return;
  const attempts = await platformQuery<{
    id: string; recorded_at: Date | null; inspect_at: Date | null; solve_at: Date | null;
  }>(db, `SELECT a.registration_id AS id,a.recorded_at,a.inspect_at,a.solve_at
    FROM platform_competition_attempts a JOIN platform_event_registrations r ON r.id=a.registration_id
    WHERE a.arena_round_id=$1::uuid AND a.attempt_number=$2 AND r.checked_in_at IS NOT NULL AND r.status IN ('confirmed','attended')
    ORDER BY r.id FOR UPDATE OF r`, [round.id, round.number]);
  for (const attempt of attempts) {
    if (attempt.recorded_at) continue;
    const reason = arenaDnfReason(round.starts_at, attempt.inspect_at, attempt.solve_at, clock.now, round.device === 'smart');
    if (!reason) continue;
    await recordArenaDnf(db, attempt.id, round.number, reason);
    attempt.recorded_at = clock.now;
  }
  if (attempts.some(attempt => !attempt.recorded_at)) return;
  if (round.number === 5 || attempts.length === 0) {
    await platformQuery(db, 'UPDATE platform_competition_arena_rounds SET completed_at=clock_timestamp() WHERE id=$1::uuid', [round.id]);
    return;
  }
  const scramble = await competitionScramble(round.project);
  const [next] = await platformQuery<{ number: number; starts_at: Date }>(db, `UPDATE platform_competition_arena_rounds
    SET number=number+1,scramble=$2,starts_at=clock_timestamp()+$3*INTERVAL '1 millisecond'
    WHERE id=$1::uuid RETURNING number,starts_at`, [round.id, scramble, COMPETITION_INTERMISSION_MS]);
  await platformQuery(db, `INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble,issued_at,arena_round_id)
    SELECT unnest($1::uuid[]),$2,$3,$4,$5::uuid`, [attempts.map(attempt => attempt.id), next.number, scramble, next.starts_at, round.id]);
}

export async function sweepCompetitionArenas(db: PlatformDb) {
  const rounds = await platformQuery<Round>(db, `SELECT ar.id,ar.session_id,ar.project,ar.device,ar.number,ar.starts_at,ar.completed_at
    FROM platform_competition_arena_rounds ar JOIN platform_competition_sessions s ON s.id=ar.session_id
    JOIN platform_events e ON e.id=s.event_id WHERE e.status='published' AND ar.completed_at IS NULL AND ar.starts_at<=clock_timestamp()
      AND (NOT EXISTS (SELECT 1 FROM platform_competition_attempts a JOIN platform_event_registrations r ON r.id=a.registration_id
        WHERE a.arena_round_id=ar.id AND a.attempt_number=ar.number AND a.recorded_at IS NULL AND r.checked_in_at IS NOT NULL AND r.status IN ('confirmed','attended'))
      OR EXISTS (SELECT 1 FROM platform_competition_attempts a JOIN platform_event_registrations r ON r.id=a.registration_id
        WHERE a.arena_round_id=ar.id AND a.attempt_number=ar.number AND a.recorded_at IS NULL AND r.checked_in_at IS NOT NULL AND r.status IN ('confirmed','attended')
          AND COALESCE(a.solve_at,a.inspect_at+(CASE WHEN ar.device='smart' THEN $2::int ELSE $3::int END)*INTERVAL '1 millisecond',a.issued_at)+$1*INTERVAL '1 millisecond'<=clock_timestamp()))
    ORDER BY ar.starts_at LIMIT 16 FOR UPDATE OF ar SKIP LOCKED`, [COMPETITION_STAGE_LIMIT_MS, COMPETITION_OBSERVATION_WINDOW_MS, ORDINARY_ARENA_OBSERVATION_WINDOW_MS]);
  for (const round of rounds) await advanceCompetitionArena(db, round);
}

export async function competitionArenaSnapshot(db: PlatformDb, entry: Entry) {
  const [snapshot] = await platformQuery(db, `WITH clock AS (SELECT clock_timestamp() AS now), arena AS (
    SELECT ar.* FROM platform_competition_arena_rounds ar WHERE ar.session_id=$1::uuid AND ar.project=$2 AND ar.device=$3
  )
  SELECT clock.now AS "serverNow",arena.id AS "roomId",arena.number AS "roundNumber",arena.starts_at AS "startsAt",
    arena.completed_at IS NOT NULL AS completed,
    CASE WHEN arena.starts_at<=clock.now THEN arena.scramble END AS scramble,
    (SELECT a.inspect_at FROM platform_competition_attempts a WHERE a.registration_id=$4::uuid AND a.attempt_number=arena.number) AS "inspectAt",
    (SELECT COALESCE(a.solve_at,CASE WHEN arena.device='smart' AND a.inspect_at+$5*INTERVAL '1 millisecond'<=clock.now
      THEN a.inspect_at+$5*INTERVAL '1 millisecond' END) FROM platform_competition_attempts a WHERE a.registration_id=$4::uuid AND a.attempt_number=arena.number) AS "solveAt",
    EXISTS(SELECT 1 FROM platform_competition_attempts a WHERE a.registration_id=$4::uuid AND a.arena_round_id=arena.id) AS seated,
    COALESCE((SELECT jsonb_agg(player) FROM (
      SELECT r.id,o.buyer_display_name_snapshot AS name,u.wca_id AS "wcaId",u.country_iso2 AS "countryCode",
        jsonb_agg(jsonb_build_object('attemptNumber',a.attempt_number,'centiseconds',a.centiseconds,'penalty',a.penalty,
          'inspectAt',a.inspect_at,'solveAt',COALESCE(a.solve_at,CASE WHEN arena.device='smart'
            AND a.inspect_at+$5*INTERVAL '1 millisecond'<=clock.now THEN a.inspect_at+$5*INTERVAL '1 millisecond' END),'dnfReason',a.dnf_reason,
          'replay',d.reported_at IS NOT NULL AND a.penalty IN ('none','+2')) ORDER BY a.attempt_number) AS attempts
      FROM platform_competition_attempts a JOIN platform_event_registrations r ON r.id=a.registration_id
      JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
      LEFT JOIN app_users u ON u.id=r.user_id
      LEFT JOIN platform_competition_device_reports d ON d.registration_id=a.registration_id AND d.attempt_number=a.attempt_number
      WHERE a.arena_round_id=arena.id AND a.issued_at<=clock.now AND r.checked_in_at IS NOT NULL AND r.status IN ('confirmed','attended')
      GROUP BY r.id,o.buyer_display_name_snapshot,u.wca_id,u.country_iso2
    ) player),'[]'::jsonb) AS players
  FROM clock LEFT JOIN arena ON TRUE`, [entry.session_id, entry.project, entry.device, entry.id, COMPETITION_OBSERVATION_WINDOW_MS]);
  if (snapshot?.seated !== true) {
    const legacy = await platformQuery<{
      attemptNumber: number; scramble: string; issuedAt: Date; centiseconds: number | null;
      penalty: string | null; inspectAt: Date | null; solveAt: Date | null; dnfReason: string | null; replay: boolean;
    }>(db, `SELECT a.attempt_number AS "attemptNumber",a.issued_at AS "issuedAt",a.scramble,a.centiseconds,a.penalty,
      COALESCE(a.inspect_at,d.started_at) AS "inspectAt",a.solve_at AS "solveAt",a.dnf_reason AS "dnfReason",
      d.reported_at IS NOT NULL AND a.penalty IN ('none','+2') AS replay
      FROM platform_competition_attempts a LEFT JOIN platform_competition_device_reports d
      ON d.registration_id=a.registration_id AND d.attempt_number=a.attempt_number
      WHERE a.registration_id=$1::uuid AND a.arena_round_id IS NULL AND a.issued_at<=clock_timestamp() ORDER BY a.attempt_number`, [entry.id]);
    if (legacy.length) {
      const current = legacy.find(attempt => !attempt.penalty);
      const [identity] = await platformQuery(db, `SELECT r.id,o.buyer_display_name_snapshot AS name,u.wca_id AS "wcaId",u.country_iso2 AS "countryCode"
        FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
        LEFT JOIN app_users u ON u.id=r.user_id WHERE r.id=$1::uuid`, [entry.id]);
      return { ...snapshot, roomId: null, seated: true, legacy: true, completed: entry.status === 'attended',
        roundNumber: current?.attemptNumber ?? Math.min(5, legacy.length + 1), scramble: current?.scramble ?? null,
        startsAt: current?.issuedAt ?? null, inspectAt: current?.inspectAt ?? null, solveAt: current?.solveAt ?? null,
        players: [{ ...identity, attempts: legacy.map(({ scramble: _scramble, ...attempt }) => attempt) }] };
    }
    if (snapshot?.roomId) return { ...snapshot, scramble: null, players: [] };
  }
  return snapshot;
}
