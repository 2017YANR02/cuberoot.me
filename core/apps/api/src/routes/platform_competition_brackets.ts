import { competitionCheckInWindow, COMPETITION_REGISTRATION_CLOSED, NO_PENDING_COMPETITION_REGISTRATIONS } from '../platform/competition_checkin.js';
import { COMPETITION_MATCH_NO_SHOW_MS, COMPETITION_INSPECTION_MS, COMPETITION_OBSERVATION_WINDOW_MS, COMPETITION_INTERMISSION_MS, COMPETITION_STAGE_LIMIT_MS, COMPETITION_START_BUFFER_MS, inspectionPenalty } from '@cuberoot/shared/timer';
import type { Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { ownerKey } from '../utils/account.js';
import { requirePlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, platformTransaction, sendMutation, withIdempotency, type PlatformDb, type PlatformMutationResult } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { enumField, integerField, readJsonObject, stringField } from '../platform/validation.js';
import { competitionEntrant, competitionTestAudience, requireCompetitionManager, validateCompetitionAttempt } from '../platform/competitions.js';
import { decideCompetitionGame, finishCompetitionMatch, foldedSeedOrder, resolveCompetitionBracketSlots, effectiveMatchTime, generateCompetitionBrackets, type Match, type MatchResult } from '../platform/competition_brackets.js';
import { competitionId, competitionScramble } from '../platform/competition_workflow.js';
import { competitionDeviceResult, competitionReplay, validateCompetitionDeviceReport, verifyCompletedCompetitionDeviceReport } from '../platform/competition_device_reports.js';
import { arenaDnfReason, arenaSolveAt, sweepCompetitionArenas } from '../platform/competition_arena.js';
import { competitionLiveCredentials, competitionLivePlayer } from '../platform/competition_live.js';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { competitionMatchCameraStatus, matchSupervisionCamerasReady, retireCompetitionVideoGeneration } from './video_rooms.js';

export const platformCompetitionBracketRoutes = platformRouter();

const SCRAMBLE_LIMIT_MS = COMPETITION_STAGE_LIMIT_MS;
const INSPECTION_SECONDS = 15;
const MATCH_START_BATCH_SIZE = 4;
const DNF = { centiseconds: null, penalty: 'DNF' } as const;
type PlayerSide = 'a' | 'b';

type Game = {
  game_number: number; ready_a_at: Date | null; ready_b_at: Date | null; start_at: Date | null;
  scramble: string | null; result_a: MatchResult | null; result_b: MatchResult | null;
  phase_a: 'inspecting' | 'solving' | null; phase_b: 'inspecting' | 'solving' | null;
  authoritative_timing: boolean;
  inspect_a_at: Date | null; inspect_b_at: Date | null; solve_a_at: Date | null; solve_b_at: Date | null;
  run_a: string | null; run_b: string | null; run_a_at: Date | null; run_b_at: Date | null;
};
type SeatMatch = Match & {
  a_user: string | null; b_user: string | null; a_status: string | null; b_status: string | null;
  device: string; project: string; eligible: boolean; title_a: string; title_b: string;
  supervision: string; before_event_start: boolean; a_checked: boolean; b_checked: boolean; a_window: boolean; b_window: boolean; event_starts_at: Date;
  a_supervisor: string | null; b_supervisor: string | null;
  a_checked_at: Date | null; b_checked_at: Date | null;
  a_wca_id: string | null; b_wca_id: string | null; a_country: string | null; b_country: string | null;
};
const MATCH_DETAILS = `SELECT m.*,t.competition_project AS project,t.competition_device AS device,
    a.user_id::text AS a_user,b.user_id::text AS b_user,a.status AS a_status,b.status AS b_status,
    c.supervision_mode AS supervision,e.starts_at AS event_starts_at,e.starts_at>clock_timestamp() AS before_event_start,
    ua.wca_id AS a_wca_id,ub.wca_id AS b_wca_id,ua.country_iso2 AS a_country,ub.country_iso2 AS b_country,
    (a.checked_in_at IS NOT NULL AND ${competitionCheckInWindow('sa')}) AS a_checked,
    ${competitionCheckInWindow('sa')} AS a_window,
    (b.checked_in_at IS NOT NULL AND ${competitionCheckInWindow('sb')}) AS b_checked,
    ${competitionCheckInWindow('sb')} AS b_window,
    CASE WHEN NOT ${competitionEntrant('e.id','sa.supervisor_user_id')} THEN sa.supervisor_user_id::text END AS a_supervisor,
    CASE WHEN NOT ${competitionEntrant('e.id','sb.supervisor_user_id')} THEN sb.supervisor_user_id::text END AS b_supervisor,
    a.checked_in_at AS a_checked_at,b.checked_in_at AS b_checked_at,
    COALESCE(ao.buyer_display_name_snapshot,'') AS title_a,COALESCE(bo.buyer_display_name_snapshot,'') AS title_b,
    (e.status='published' AND ${competitionCheckInWindow('e')}) AS eligible
  FROM platform_competition_matches m JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id
  JOIN platform_events e ON e.id=m.event_id
  JOIN platform_competitions c ON c.event_id=m.event_id
  LEFT JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
  LEFT JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
  LEFT JOIN app_users ua ON ua.id=a.user_id LEFT JOIN app_users ub ON ub.id=b.user_id
  LEFT JOIN platform_competition_sessions sa ON sa.id=a.competition_session_id
  LEFT JOIN platform_competition_sessions sb ON sb.id=b.competition_session_id
  LEFT JOIN platform_order_items ai ON ai.id=a.order_item_id LEFT JOIN platform_orders ao ON ao.id=ai.order_id
  LEFT JOIN platform_order_items bi ON bi.id=b.order_item_id LEFT JOIN platform_orders bo ON bo.id=bi.order_id
  WHERE m.id=$1::uuid`;

// A write that touches the bracket always takes the competition lock before any match lock.
async function lockMatch(db: PlatformDb, id: string, competition = false) {
  if (competition) await platformQuery(db, `SELECT c.event_id FROM platform_competition_matches m JOIN platform_competitions c ON c.event_id=m.event_id
    WHERE m.id=$1::uuid FOR UPDATE OF c`, [id]);
  await platformQuery(db, 'SELECT id FROM platform_competition_matches WHERE id=$1::uuid FOR UPDATE', [id]);
}

async function ownMatch(db: PlatformDb, id: string, userId: number | null) {
  const [match] = await platformQuery<SeatMatch>(db, MATCH_DETAILS, [id]);
  if (!match) notFound('Match');
  return { match, side: matchPlayerSide(match, userId) };
}

function matchPlayerSide(match: SeatMatch, userId: number | null): PlayerSide {
  if (userId != null && match.a_user === String(userId)) return 'a';
  if (userId != null && match.b_user === String(userId)) return 'b';
  forbidden('Only the participants may open this match seat');
}

const GAME_FIELDS = `game_number,ready_a_at,ready_b_at,start_at,scramble,result_a,result_b,phase_a,phase_b,
  authoritative_timing,inspect_a_at,inspect_b_at,solve_a_at,solve_b_at,run_a,run_b,run_a_at,run_b_at`;

async function activeGame(db: PlatformDb, id: string) {
  const [row] = await platformQuery<Game>(db, `SELECT ${GAME_FIELDS}
    FROM platform_competition_match_games WHERE match_id=$1::uuid AND resolved_at IS NULL ORDER BY game_number DESC LIMIT 1`, [id]);
  return row;
}

function timedOrdinaryGame(match: Pick<SeatMatch, 'device'>, game: Pick<Game, 'authoritative_timing'>) {
  return match.device === 'ordinary' && game.authoritative_timing;
}

function timingExpired(game: Game | GameSnapshot, side: PlayerSide, now: Date, smart = false) {
  if (!game.start_at) return false;
  const inspected = game[`inspect_${side}_at`] ?? (smart ? game[`run_${side}_at`] : null);
  const solve = game[`solve_${side}_at`];
  if (smart) return arenaDnfReason(new Date(game.start_at), inspected ? new Date(inspected) : null, solve ? new Date(solve) : null, now) !== null;
  if (solve) return +now - +new Date(solve) >= COMPETITION_STAGE_LIMIT_MS;
  return inspected ? inspectionPenalty(+now - +new Date(inspected), INSPECTION_SECONDS) === 'DNF'
    : +now - +new Date(game.start_at) >= SCRAMBLE_LIMIT_MS;
}

function requireActiveMatch(match: SeatMatch) {
  if (!match.eligible || !['ready', 'in_progress'].includes(match.status) || match.a_status !== 'confirmed' || match.b_status !== 'confirmed') {
    conflict('Both entrants must have an active registration in a playable match');
  }
}

const PLAYER_SIDES = ['a', 'b'] as const;

function supervisionKey(match: SeatMatch, sides: readonly PlayerSide[]) {
  return JSON.stringify([match.video_generation, match.supervision, match.status, ...sides.map(side =>
    [match[`${side}_user`], match[`${side}_status`], match[`${side}_checked_at`], match[`${side}_supervisor`]])]);
}

async function matchSupervisionReady(match: SeatMatch, sides: readonly PlayerSide[]) {
  if (match.supervision !== 'supervised') return true;
  if (!match.eligible || !['ready', 'in_progress'].includes(match.status)) return false;
  const users: string[] = [];
  for (const side of sides) {
    const user = match[`${side}_user`];
    const judge = match[`${side}_supervisor`];
    if (!match[`${side}_checked`] || match[`${side}_status`] !== 'confirmed' || !user || !judge || user === judge) return false;
    users.push(user, judge);
  }
  return matchSupervisionCamerasReady(match.id, match.video_generation, users);
}

// Premature starts require closed intake and a fully checked-in division.
const DUEL_START_WINDOW = `(e.starts_at<=clock_timestamp() OR (${COMPETITION_REGISTRATION_CLOSED} AND (
  SELECT COUNT(*)>=2 AND BOOL_AND(r.checked_in_at IS NOT NULL)
  FROM platform_event_registrations r WHERE r.event_id=e.id AND r.ticket_type_id=m.ticket_type_id
    AND r.status IN ('confirmed','attended')
)))`;

function matchCheckInReady(match: SeatMatch, side: PlayerSide) {
  return !!match[`${side}_window`] && (match.supervision === 'offline' || !!match[`${side}_checked`]);
}

async function startReadyGame(id: string) {
  const db = platformDb();
  const [prior] = await platformQuery<SeatMatch>(db, MATCH_DETAILS, [id]);
  if (!prior?.eligible || prior.status !== 'ready') return;
  const game = await activeGame(db, id);
  if (game?.start_at || !game?.ready_a_at || !game.ready_b_at || !await matchSupervisionReady(prior, PLAYER_SIDES)) return;
  const scramble = await competitionScramble(prior.project);

  await platformTransaction(async tx => {
    await lockMatch(tx, id, prior.before_event_start);
    const [match] = await platformQuery<SeatMatch>(tx, MATCH_DETAILS, [id]);
    if (!match?.eligible || match.status !== 'ready' || (match.before_event_start && !prior.before_event_start) || match.a_status !== 'confirmed' || match.b_status !== 'confirmed'
      || !PLAYER_SIDES.every(side => matchCheckInReady(match, side))
      || supervisionKey(prior, PLAYER_SIDES) !== supervisionKey(match, PLAYER_SIDES)) return;
    const [started] = await platformQuery(tx, `UPDATE platform_competition_match_games g
      SET start_at=clock_timestamp()+$4*INTERVAL '1 millisecond',scramble=$3
      FROM platform_competition_matches m JOIN platform_events e ON e.id=m.event_id
      JOIN platform_competitions c ON c.event_id=m.event_id
      WHERE g.match_id=m.id AND m.id=$1::uuid AND g.game_number=$2 AND g.resolved_at IS NULL AND g.start_at IS NULL
        AND g.ready_a_at IS NOT NULL AND g.ready_b_at IS NOT NULL
        AND e.status='published' AND clock_timestamp()<e.ends_at AND ${DUEL_START_WINDOW}
      RETURNING g.match_id`, [id, game.game_number, scramble, COMPETITION_START_BUFFER_MS]);
    if (started) await platformQuery(tx, "UPDATE platform_competition_matches SET status='in_progress' WHERE id=$1::uuid", [id]);
  });
}

export async function startReadyCompetitionGames() {
  const candidates = await platformQuery<{ id: string }>(platformDb(), `SELECT m.id::text
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
    JOIN platform_competition_matches m ON m.event_id=e.id
    JOIN platform_competition_match_games g ON g.match_id=m.id
    JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
    JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
    WHERE e.status='published' AND ${competitionCheckInWindow('e')} AND m.status='ready'
      AND a.status='confirmed' AND b.status='confirmed' AND g.resolved_at IS NULL AND g.start_at IS NULL
      AND g.ready_a_at IS NOT NULL AND g.ready_b_at IS NOT NULL AND ${DUEL_START_WINDOW}
    ORDER BY GREATEST(g.ready_a_at,g.ready_b_at),m.id`);
  for (let offset = 0; offset < candidates.length; offset += MATCH_START_BATCH_SIZE) {
    await Promise.all(candidates.slice(offset, offset + MATCH_START_BATCH_SIZE).map(({ id }) => startReadyGame(id)));
  }
}

async function generationWindow(db: PlatformDb, eventId: string) {
  const [row] = await platformQuery<{ eligible: boolean; generated: boolean }>(db, `
    SELECT e.status='published' AND c.competition_format='advancement' AND c.registration_closes_at<=NOW() AND ${NO_PENDING_COMPETITION_REGISTRATIONS} AS eligible,
      c.brackets_generated_at IS NOT NULL AS generated
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id WHERE e.id=$1::uuid`, [eventId]);
  return row;
}

platformCompetitionBracketRoutes.post('/platform/competitions/:id/brackets/generate', async c => {
  const actor = await requirePlatformActor(c);
  const eventId = competitionId(c.req.param('id'));
  const body = await readJsonObject(c);
  return sendMutation(c, await withIdempotency(c, actor, `competition.bracket.generate:${eventId}`, body, async db => {
    await requireCompetitionManager(db, actor, eventId);
    const window = await generationWindow(db, eventId);
    if (!window?.eligible) conflict('Generate brackets after registration closes and all held places have been resolved');
    if (!window.generated) await generateCompetitionBrackets(db, eventId);
    return { status: 200, body: { id: eventId, generated: true } };
  }, db => requireCompetitionManager(db, actor, eventId)));
});

platformCompetitionBracketRoutes.get('/platform/competitions/:id/brackets', async c => {
  privateNoStore(c);
  const eventId = competitionId(c.req.param('id'));
  const actor = c.req.header('Authorization') ? await requirePlatformActor(c) : null;
  const [event] = await platformQuery<{ generated: boolean }>(platformDb(), `SELECT c.brackets_generated_at IS NOT NULL AS generated
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
    WHERE c.event_id=$1::uuid AND c.competition_format='advancement' AND e.status IN ('published','completed')
      AND (NOT c.is_test OR ${competitionTestAudience('$2')})`, [eventId, actor?.userId ?? null]);
  if (!event) notFound('Competition bracket');
  const [matches, standings] = await Promise.all([
    platformQuery<{ id: string; ticketId: string; side: string; round: number; number: number; playerA: string | null; playerB: string | null; nextWin: string | null }>(platformDb(), `SELECT m.id::text,m.ticket_type_id::text AS "ticketId",
      t.competition_project AS project,t.competition_device AS device,
      m.bracket_side AS side,m.round_number AS round,m.match_number AS number,m.best_of AS "bestOf",
      m.player_a_registration_id::text AS "playerA",m.player_b_registration_id::text AS "playerB",
      ao.buyer_display_name_snapshot AS "nameA",bo.buyer_display_name_snapshot AS "nameB",
      ua.country_iso2 AS "countryA",ub.country_iso2 AS "countryB",m.ready_at AS "readyAt",
      CASE WHEN m.status='ready' AND m.ready_at IS NOT NULL THEN GREATEST(m.ready_at,e.starts_at)+$2*INTERVAL '1 millisecond' END AS "noShowDeadlineAt",
      m.score_a AS "scoreA",m.score_b AS "scoreB",m.winner_registration_id::text AS winner,m.status,
      m.forfeit_reason AS "forfeitReason",a.checked_in_at IS NOT NULL AS "checkedInA",b.checked_in_at IS NOT NULL AS "checkedInB",
      EXISTS(SELECT 1 FROM platform_competition_match_games g WHERE g.match_id=m.id AND g.resolved_at IS NULL AND g.ready_a_at IS NOT NULL) AS "readyA",
      EXISTS(SELECT 1 FROM platform_competition_match_games g WHERE g.match_id=m.id AND g.resolved_at IS NULL AND g.ready_b_at IS NOT NULL) AS "readyB",
      CASE WHEN m.status='in_progress' THEN (SELECT COALESCE(
        MAX(g.game_number) FILTER (WHERE g.resolved_at IS NULL),MAX(g.game_number)+1,1)
        FROM platform_competition_match_games g WHERE g.match_id=m.id) END AS "gameNumber",
      active.start_at AS "gameStartsAt",active.result_a->>'penalty' AS "penaltyA",active.result_b->>'penalty' AS "penaltyB",
      m.next_win_match_id::text AS "nextWin",m.next_loss_match_id::text AS "nextLoss"
      FROM platform_competition_matches m JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id
      JOIN platform_events e ON e.id=m.event_id
      LEFT JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
      LEFT JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
      LEFT JOIN app_users ua ON ua.id=a.user_id LEFT JOIN app_users ub ON ub.id=b.user_id
      LEFT JOIN platform_order_items ai ON ai.id=a.order_item_id LEFT JOIN platform_orders ao ON ao.id=ai.order_id
      LEFT JOIN platform_order_items bi ON bi.id=b.order_item_id LEFT JOIN platform_orders bo ON bo.id=bi.order_id
      LEFT JOIN LATERAL (SELECT g.start_at,g.result_a,g.result_b FROM platform_competition_match_games g
        WHERE g.match_id=m.id AND g.resolved_at IS NULL ORDER BY g.game_number DESC LIMIT 1) active ON true
      WHERE m.event_id=$1::uuid ORDER BY m.bracket_side,m.round_number,m.match_number`, [eventId, COMPETITION_MATCH_NO_SHOW_MS]),
    platformQuery(platformDb(), `WITH final AS (
      SELECT DISTINCT ON (ticket_type_id) ticket_type_id,status,winner_registration_id,player_a_registration_id,player_b_registration_id
      FROM platform_competition_matches WHERE event_id=$1::uuid AND bracket_side='grand_final'
      ORDER BY ticket_type_id,round_number DESC
    ), participants AS (
      SELECT m.id,m.ticket_type_id,m.bracket_side,m.round_number,m.status,m.winner_registration_id,
        p.registration_id,p.slot
      FROM platform_competition_matches m JOIN LATERAL (VALUES (m.player_a_registration_id,'a'),(m.player_b_registration_id,'b')) AS p(registration_id,slot) ON true
      WHERE m.event_id=$1::uuid AND p.registration_id IS NOT NULL
    ), totals AS (
      SELECT p.registration_id,p.ticket_type_id,
        COUNT(*) FILTER (WHERE g.winner_registration_id=p.registration_id)::integer AS wins,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status='completed' AND p.winner_registration_id=p.registration_id)::integer AS "matchWins",
        COUNT(DISTINCT p.id) FILTER (WHERE p.status='completed' AND p.winner_registration_id IS DISTINCT FROM p.registration_id)::integer AS "matchLosses",
        MAX(p.round_number) FILTER (WHERE p.bracket_side='losers' AND p.status='completed'
          AND p.winner_registration_id IS DISTINCT FROM p.registration_id) AS "losersElimination",
        MAX(p.round_number) FILTER (WHERE p.bracket_side='winners' AND p.status='completed'
          AND p.winner_registration_id IS NULL) AS "winnersElimination",
        MAX(g.resolved_at) AS "recordedAt",
        MIN(CASE WHEN result->>'penalty' IN ('none','+2') THEN (result->>'centiseconds')::integer +
          CASE WHEN result->>'penalty'='+2' THEN 200 ELSE 0 END END) AS best
      FROM participants p LEFT JOIN platform_competition_match_games g ON g.match_id=p.id
      LEFT JOIN LATERAL (SELECT CASE WHEN p.slot='a' THEN g.result_a ELSE g.result_b END AS result) result_row ON true
      GROUP BY p.registration_id,p.ticket_type_id
    )
    SELECT r.id::text,r.ticket_type_id::text AS "ticketId",o.buyer_display_name_snapshot AS name,u.wca_id AS "wcaId",CASE WHEN u.wca_id IS NOT NULL THEN u.country_iso2 END AS "countryCode",
      COALESCE(t.wins,0) AS wins,COALESCE(t."matchWins",0) AS "matchWins",COALESCE(t."matchLosses",0) AS "matchLosses",t.best,t."recordedAt",
      CASE WHEN t."losersElimination" IS NOT NULL THEN 'losers' WHEN t."winnersElimination" IS NOT NULL THEN 'winners' END AS "eliminationSide",
      COALESCE(t."losersElimination",t."winnersElimination") AS "eliminationRound",
      ROW_NUMBER() OVER (PARTITION BY r.ticket_type_id ORDER BY
        CASE WHEN f.status IN ('completed','bye') AND f.winner_registration_id IS NOT NULL
          THEN CASE WHEN f.winner_registration_id=r.id THEN 1 WHEN r.id IN (f.player_a_registration_id,f.player_b_registration_id) THEN 2 END END NULLS LAST,
        CASE WHEN t."losersElimination" IS NULL AND t."winnersElimination" IS NULL THEN 0
          WHEN t."losersElimination" IS NOT NULL THEN 1 ELSE 2 END,
        t."losersElimination" DESC NULLS LAST,t."winnersElimination" DESC NULLS LAST,
        t.wins DESC NULLS LAST,t.best NULLS LAST,r.created_at,r.id)::integer AS rank
    FROM platform_event_registrations r
    JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
    LEFT JOIN app_users u ON u.id=r.user_id LEFT JOIN totals t ON t.registration_id=r.id
    LEFT JOIN final f ON f.ticket_type_id=r.ticket_type_id
    WHERE r.event_id=$1::uuid AND r.status IN ('confirmed','attended')`, [eventId]),
  ]);
  const firstRounds = new Map<string, typeof matches>();
  for (const match of matches) {
    if (match.side !== 'winners' || match.round !== 1) continue;
    const round = firstRounds.get(match.ticketId) ?? [];
    round.push(match);
    firstRounds.set(match.ticketId, round);
  }
  const seeds = new Map<string, number>();
  for (const firstRound of firstRounds.values()) {
    const order = foldedSeedOrder(firstRound.length * 2);
    for (const match of firstRound) {
      if (match.playerA) seeds.set(match.playerA, order[(match.number - 1) * 2]);
      if (match.playerB) seeds.set(match.playerB, order[(match.number - 1) * 2 + 1]);
    }
  }
  const finals = new Set(matches.filter(match => match.side === 'grand_final' && match.round === 1).map(match => match.id));
  return c.json({ generated: event.generated, matches: matches.map(match => ({
    ...match, code: match.nextWin && finals.has(match.nextWin)
      ? match.side === 'losers' ? 'LF' : match.round > 1 ? 'WF' : undefined
      : undefined,
    seedA: match.playerA ? seeds.get(match.playerA) : undefined, seedB: match.playerB ? seeds.get(match.playerB) : undefined,
  })), standings: event.generated ? standings : [] });
});

type GameSnapshot = Omit<Game, 'start_at' | 'inspect_a_at' | 'inspect_b_at' | 'solve_a_at' | 'solve_b_at' | 'run_a_at' | 'run_b_at'> & {
  start_at: string | null; inspect_a_at: string | null; inspect_b_at: string | null; solve_a_at: string | null; solve_b_at: string | null;
  run_a_at: string | null; run_b_at: string | null;
};
type SettledGame = Pick<Game, 'game_number' | 'result_a' | 'result_b'> & { winner_registration_id: string | null };

async function readSeatSnapshot(id: string) {
  const [snapshot] = await platformQuery<SeatMatch & {
    now: Date; forfeit_reason: string | null;
    active: GameSnapshot | null; last: SettledGame | null;
    history: Array<SettledGame & { replay_a: boolean; replay_b: boolean }>;
  }>(platformDb(), `SELECT m.*,clock_timestamp() AS now,
    (SELECT to_jsonb(g) FROM (
      SELECT ${GAME_FIELDS} FROM platform_competition_match_games WHERE match_id=m.id AND resolved_at IS NULL AND m.status IN ('ready','in_progress') ORDER BY game_number DESC LIMIT 1
    ) g) AS active,
    (SELECT to_jsonb(g) FROM (
      SELECT game_number,result_a,result_b,winner_registration_id FROM platform_competition_match_games
      WHERE match_id=m.id AND resolved_at IS NOT NULL AND start_at IS NOT NULL ORDER BY game_number DESC LIMIT 1
    ) g) AS last,
    COALESCE((SELECT jsonb_agg(g ORDER BY game_number) FROM (
      SELECT game_number,result_a,result_b,winner_registration_id,report_a IS NOT NULL AND result_a->>'penalty'='none' AS replay_a,
        report_b IS NOT NULL AND result_b->>'penalty'='none' AS replay_b
      FROM platform_competition_match_games WHERE match_id=m.id AND resolved_at IS NOT NULL AND start_at IS NOT NULL
    ) g),'[]'::jsonb) AS history
    FROM (${MATCH_DETAILS}) m`, [id]);
  if (!snapshot) notFound('Match');
  return snapshot;
}

function noShowDeadline(match: Pick<SeatMatch, 'status' | 'ready_at' | 'event_starts_at'>) {
  return match.status === 'ready' && match.ready_at
    ? new Date(Math.max(+match.ready_at, +match.event_starts_at) + COMPETITION_MATCH_NO_SHOW_MS) : null;
}

function readyForWalkover(match: SeatMatch, game: Pick<Game, 'ready_a_at' | 'ready_b_at'> | GameSnapshot | undefined | null, side: PlayerSide) {
  return match[`${side}_status`] === 'confirmed' && matchCheckInReady(match, side) && !!game?.[`ready_${side}_at`];
}

function gameNeedsExpiry(game: Game | GameSnapshot | undefined | null, now: Date, smart: boolean) {
  return !!game?.start_at && (smart || game.authoritative_timing)
    && PLAYER_SIDES.some(side => !game[`result_${side}`] && timingExpired(game, side, now, smart));
}

type NextMatch = {
  nextMatchId: string | null; nextMatchSide: Match['bracket_side'] | null; nextMatchRound: number | null;
  nextMatchStatus: string | null; nextOpponentName: string | null;
};
type NextStep = NextMatch & { outcome: 'advanced' | 'dropped_to_losers' | 'eliminated' | 'champion' | 'runner_up' | 'pending_reset' };
async function matchNextStep(
  match: SeatMatch, registrationId: string | null,
): Promise<NextStep | null> {
  if (!['completed', 'bye'].includes(match.status)) return null;
  const won = match.winner_registration_id !== null && match.winner_registration_id === registrationId;
  const reset = match.bracket_side === 'grand_final' && match.round_number === 1 && !!match.next_win_match_id;
  const target = reset || won ? match.next_win_match_id : match.winner_registration_id ? match.next_loss_match_id : null;
  const outcome = reset ? 'pending_reset' : target ? (won ? 'advanced' : 'dropped_to_losers')
    : match.bracket_side === 'grand_final' && match.winner_registration_id ? (won ? 'champion' : 'runner_up') : 'eliminated';
  const [next] = target ? await platformQuery<NextMatch>(platformDb(), `SELECT m.id::text AS "nextMatchId",m.bracket_side AS "nextMatchSide",
    m.round_number AS "nextMatchRound",m.status AS "nextMatchStatus",o.buyer_display_name_snapshot AS "nextOpponentName"
    FROM platform_competition_matches m
    LEFT JOIN platform_event_registrations r ON r.id=CASE WHEN m.player_a_registration_id=$2 THEN m.player_b_registration_id ELSE m.player_a_registration_id END
    LEFT JOIN platform_order_items i ON i.id=r.order_item_id LEFT JOIN platform_orders o ON o.id=i.order_id
    WHERE m.id=$1 AND $2 IN (m.player_a_registration_id,m.player_b_registration_id)`, [target, registrationId]) : [];
  if (next?.nextMatchId && next.nextMatchStatus === 'bye') {
    // Vacancies can carry a player through multiple rounds in one transaction.
    const [forward] = await platformQuery<SeatMatch>(platformDb(), MATCH_DETAILS, [next.nextMatchId]);
    const forwarded = await matchNextStep(forward, registrationId);
    if (forwarded) return { ...forwarded, outcome: ['advanced','dropped_to_losers'].includes(forwarded.outcome) ? outcome : forwarded.outcome };
  }
  return next ? { outcome, ...next } : { outcome, nextMatchId: null, nextMatchSide: null, nextMatchRound: null, nextMatchStatus: null, nextOpponentName: null };
}

platformCompetitionBracketRoutes.get('/platform/competitions/matches/:id', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  let snapshot = await readSeatSnapshot(id);
  const side = matchPlayerSide(snapshot, actor.userId);
  const deadline = noShowDeadline(snapshot);
  const canExpire = snapshot.status === 'in_progress' && gameNeedsExpiry(snapshot.active, snapshot.now, snapshot.device === 'smart');
  const noShow = deadline && snapshot.now >= deadline && !snapshot.active?.start_at
    && !PLAYER_SIDES.every(seat => readyForWalkover(snapshot, snapshot.active, seat));
  if (snapshot.eligible && (canExpire || noShow)) {
    const retired = await platformTransaction(async db => {
      await lockMatch(db, id, true);
      const { match: locked } = await ownMatch(db, id, actor.userId);
      if (!locked.eligible) return false;
      return locked.status === 'ready' ? closeNoShowMatch(db, locked)
        : locked.status === 'in_progress' && await expireMatchGame(db, locked, locked.device === 'smart');
    });
    if (retired && snapshot.supervision === 'supervised') void retireCompetitionVideoGeneration(id, snapshot.video_generation, true);
    snapshot = await readSeatSnapshot(id);
  }
  const { active: game, last, now } = snapshot;
  const match = snapshot;
  const opponent = side === 'a' ? 'b' : 'a';
  const registrationId = side === 'a' ? match.player_a_registration_id : match.player_b_registration_id;
  const checkedIn = !!match[`${side}_checked`];
  const canPlay = match.eligible && !!match[`${side}_window`] && match.a_status === 'confirmed' && match.b_status === 'confirmed';
  const canReadLive = canPlay && matchCheckInReady(match, side) && ['ready','in_progress'].includes(snapshot.status);
  const iso = (timestamp: string | Date | null) => timestamp ? new Date(timestamp).toISOString() : null;
  const effectiveSolveAt = (seat: PlayerSide) => {
    const solve = game?.[`solve_${seat}_at`];
    if (solve) return iso(solve);
    const inspect = game?.[`inspect_${seat}_at`] ?? game?.[`run_${seat}_at`];
    if (!inspect || match.device !== 'smart') return null;
    const automatic = new Date(+new Date(inspect) + COMPETITION_OBSERVATION_WINDOW_MS);
    return automatic <= now ? iso(automatic) : null;
  };
  const activeGame = game ? {
    gameNumber: game.game_number,
    startAt: iso(game.start_at),
    scramble: canReadLive && game.start_at && new Date(game.start_at) <= now ? game.scramble : null,
    ownReady: !!game[`ready_${side}_at`], opponentReady: !!game[`ready_${opponent}_at`],
    ownResult: game[`result_${side}`], opponentFinished: !!game[`result_${opponent}`],
    opponentResult: game[`result_${opponent}`],
    opponentPhase: game[`phase_${opponent}`],
    opponentInspectAt: iso(game[`inspect_${opponent}_at`] ?? game[`run_${opponent}_at`]),
    opponentSolveAt: effectiveSolveAt(opponent),
    runId: game[`run_${side}`],
    authoritativeTiming: timedOrdinaryGame(match, game),
    inspectAt: iso(game[`inspect_${side}_at`] ?? game[`run_${side}_at`]), solveAt: effectiveSolveAt(side),
    scrambleDeadlineAt: game.start_at ? new Date(+new Date(game.start_at) + SCRAMBLE_LIMIT_MS) : null,
    inspectionSeconds: match.device === 'smart' ? COMPETITION_INSPECTION_MS / 1000 : INSPECTION_SECONDS,
  } : null;
  return c.json({
    id, eventId: match.event_id, project: match.project, device: match.device, status: snapshot.status,
    registrationId,
    bestOf: match.best_of, bracketSide: match.bracket_side, bracketRound: match.round_number, bracketNumber: match.match_number,
    supervisorVideoIdentity: match.supervision === 'supervised' && match[`${side}_supervisor`] ? `u${match[`${side}_supervisor`]}` : null,
    credentials: canReadLive ? competitionLiveCredentials(id, actor.userId) : null,
    ownIdentity: { name: match[`title_${side}`], wcaId: match[`${side}_wca_id`], countryCode: match[`${side}_country`] },
    opponentIdentity: { name: match[`title_${opponent}`], wcaId: match[`${opponent}_wca_id`], countryCode: match[`${opponent}_country`] },
    opponentPlayerId: competitionLivePlayer(match[`${opponent}_user`]),
    supervisionMode: match.supervision, requiresSupervision: match.supervision === 'supervised', checkedIn,
    ownName: side === 'a' ? match.title_a : match.title_b, opponentName: side === 'a' ? match.title_b : match.title_a,
    ownScore: side === 'a' ? snapshot.score_a : snapshot.score_b, opponentScore: side === 'a' ? snapshot.score_b : snapshot.score_a,
    serverNow: now,
    canPlay, sessionStartsAt: match.event_starts_at,
    noShowDeadlineAt: game?.start_at ? null : noShowDeadline(snapshot),
    forfeitReason: snapshot.forfeit_reason,
    nextStep: await matchNextStep(match, registrationId),
    gameNumber: activeGame?.gameNumber ?? ((last?.game_number ?? 0) + 1),
    startAt: activeGame?.startAt ?? null, scramble: activeGame?.scramble ?? null,
    ownReady: activeGame?.ownReady ?? false, opponentReady: activeGame?.opponentReady ?? false,
    ownResult: activeGame?.ownResult ?? null, opponentFinished: activeGame?.opponentFinished ?? false,
    opponentPhase: activeGame?.opponentPhase ?? null, runId: activeGame?.runId ?? null,
    activeGame,
    history: snapshot.history.map(game => ({
      gameNumber: game.game_number, ownResult: game[`result_${side}`], opponentResult: game[`result_${opponent}`],
      ownReplay: game[`replay_${side}`], opponentReplay: game[`replay_${opponent}`],
      winner: game.winner_registration_id == null ? 'draw' : game.winner_registration_id === registrationId ? 'own' : 'opponent',
    })),
    lastGame: last ? {
      gameNumber: last.game_number, ownResult: last[`result_${side}`], opponentResult: last[`result_${opponent}`],
      winner: last.winner_registration_id == null ? 'draw' : last.winner_registration_id === registrationId ? 'own' : 'opponent',
    } : null,
  });
});

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/ready', async c => {
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  const body = await readJsonObject(c);
  const number = integerField(body, 'gameNumber', { required: true, min: 1 })!;
  let attemptStart = false;
  const response = await withIdempotency(c, actor, `competition.match.ready:${id}:${number}`, body, async db => {
    await lockMatch(db, id);
    const { match, side } = await ownMatch(db, id, actor.userId);
    requireActiveMatch(match);
    if (!matchCheckInReady(match, side)) conflict('Check in before readying a match seat');
    const game = await activeGame(db, id);
    const other = side === 'a' ? 'b' : 'a';
    attemptStart = !!game?.[`ready_${other}_at`] && !game.start_at;
    if (game?.[`ready_${side}_at`] && game.game_number === number) return { status: 200, body: { ready: true } };
    const [{ now }] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
    const deadline = noShowDeadline(match);
    if (deadline && now >= deadline) conflict('The match readiness deadline has passed');
    if (!game) {
      const [next] = await platformQuery<{ number: number }>(db, `SELECT COALESCE(MAX(game_number),0)::integer+1 AS number
        FROM platform_competition_match_games WHERE match_id=$1::uuid`, [id]);
      if (next.number !== number) conflict('This game is no longer current');
      await platformQuery(db, `INSERT INTO platform_competition_match_games(match_id,game_number,ready_${side}_at)
        VALUES($1::uuid,$2,clock_timestamp())`, [id, number]);
    } else {
      if (game.game_number !== number) conflict('This game is no longer current');
      await platformQuery(db, `UPDATE platform_competition_match_games SET ready_${side}_at=clock_timestamp()
        WHERE match_id=$1::uuid AND game_number=$2`, [id, number]);
    }
    return { status: 200, body: { ready: true } };
  });
  // Players can mark themselves ready while the supervisor is still at another table.
  // The start check reads cameras after commit, with neither a transaction nor a match lock held.
  if (!response.replayed && attemptStart) await startReadyGame(id);
  return sendMutation(c, response);
});

platformCompetitionBracketRoutes.get('/platform/competitions/:id/supervision-cameras', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const eventId = competitionId(c.req.param('id'));
  const matches = await platformQuery<{ id: string; generation: string; a: string; b: string }>(platformDb(), `
    SELECT m.id::text,m.video_generation::text AS generation,a.user_id::text AS a,b.user_id::text AS b
    FROM platform_competition_matches m JOIN platform_competitions c ON c.event_id=m.event_id
    JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
    JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
    JOIN platform_competition_sessions sa ON sa.id=a.competition_session_id
    JOIN platform_competition_sessions sb ON sb.id=b.competition_session_id
    WHERE m.event_id=$1 AND c.supervision_mode='supervised' AND m.status IN ('ready','in_progress')
      AND $2 IN (sa.supervisor_user_id,sb.supervisor_user_id) AND NOT ${competitionEntrant('m.event_id','$2')}`,
  [eventId, actor.userId]);
  return c.json({
    cameras: await competitionMatchCameraStatus(matches),
    participants: Object.fromEntries(matches.map(match => [match.id, { a: `u${match.a}`, b: `u${match.b}` }])),
    dispatchBatchSize: MATCH_START_BATCH_SIZE,
  });
});

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/supervision', async c => {
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  const body = await readJsonObject(c);
  const action = enumField(body, 'action', ['remind', '+2', 'DNF', 'replay', 'absence'] as const, { required: true });
  const target = enumField(body, 'side', PLAYER_SIDES);
  const number = integerField(body, 'gameNumber', { min: 1 });
  let retirement: string | null = null;
  const response = await withIdempotency(c, actor, `competition.match.supervision:${id}`, body, async db => {
    await lockMatch(db, id, true);
    const [match] = await platformQuery<SeatMatch>(db, MATCH_DETAILS, [id]);
    if (!match) notFound('Match');
    const assigned = PLAYER_SIDES.filter(side => !!actor.userId && match[`${side}_supervisor`] === String(actor.userId));
    if (match.supervision !== 'supervised' || !assigned.length || (target && !assigned.includes(target))) {
      forbidden('Only an assigned judge may supervise this seat');
    }
    requireActiveMatch(match);
    const game = await activeGame(db, id);
    if (action === 'remind') {
      if (!target) badRequest('Select the entrant to remind');
      const userId = match[`${target}_user`];
      if (!userId || game?.start_at) conflict('Readiness reminders are for waiting seats');
      await platformQuery(db, `INSERT INTO notifications(user_key,kind,actor_name,title,excerpt,link,dedupe_key)
        VALUES($1,'competition_ready_reminder','CubeRoot',$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [ownerKey(Number(userId), match[`${target}_wca_id`]), '对局就绪提醒 / Match readiness reminder',
        '请检查检录和摄像头状态。 / Check your check-in and camera status.',
        `/competitions/${match.event_id}`, `competition-reminder:${id}:${target}:${Math.floor(Date.now() / 60_000)}`]);
    } else if (action === 'absence') {
      if (!await closeNoShowMatch(db, match)) conflict('No absence can be ruled before the readiness deadline or after both players are ready');
      retirement = match.video_generation;
    } else {
      const [{ now }] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
      if (!game?.start_at || game.start_at > now || game.game_number !== number) conflict('This game is no longer active');
      if (action === 'replay') {
        if (assigned.length !== 2) forbidden('A replay requires the judge assigned to both seats');
        const scramble = await competitionScramble(match.project as Parameters<typeof competitionScramble>[0]);
        // Mark the voided game resolved without counting it in public results.
        await platformQuery(db, `UPDATE platform_competition_match_games SET resolved_at=$3,start_at=NULL,scramble=NULL,result_a=NULL,result_b=NULL,
          inspect_a_at=NULL,inspect_b_at=NULL,solve_a_at=NULL,solve_b_at=NULL
          WHERE match_id=$1 AND game_number=$2`, [id, number, now]);
        await platformQuery(db, `INSERT INTO platform_competition_match_games(match_id,game_number,ready_a_at,ready_b_at,start_at,scramble)
          VALUES($1,$2,$3,$3,$3::timestamptz+$4*INTERVAL '1 millisecond',$5)`, [id, game.game_number + 1, now, COMPETITION_INTERMISSION_MS, scramble]);
      } else {
        if (!target) badRequest('Select the entrant to rule on');
        const previous = game[`result_${target}`];
        if (action === '+2' && previous?.penalty !== 'none') conflict('A valid submitted time is required for +2');
        const result = action === '+2' ? { ...previous!, penalty: '+2' as const } : DNF;
        if (previous) {
          // The active game has at most one submitted result.
          await platformQuery(db, `UPDATE platform_competition_match_games SET result_${target}=$3::jsonb WHERE match_id=$1 AND game_number=$2`, [id, number, result]);
        } else {
          await saveMatchResult(db, match, target, game, result);
          const [current] = await platformQuery<{ status: string }>(db, 'SELECT status FROM platform_competition_matches WHERE id=$1', [id]);
          if (current.status === 'completed') retirement = match.video_generation;
        }
      }
    }
    await platformQuery(db, `INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome,metadata)
      VALUES($1,$2,'competition.match.supervision','competition_match',$3,'allowed',$4::jsonb)`,
    [actor.userId, actor.ownerKey, id, { action, side: target, gameNumber: number, previousA: game?.result_a, previousB: game?.result_b }]);
    return { status: 200, body: { applied: true } };
  });
  if (retirement) void retireCompetitionVideoGeneration(id, retirement, true);
  return sendMutation(c, response);
});

class BracketLockRequired extends Error {}

async function playMatch(
  c: Context, actor: Awaited<ReturnType<typeof requirePlatformActor>>, id: string, number: number,
  scope: string, body: unknown, requireCameras: boolean,
  play: (seat: { db: PlatformDb; match: SeatMatch; side: PlayerSide; game: Game; now: Date;
    save: (result: MatchResult) => Promise<void> }) => Promise<PlatformMutationResult>,
) {
  const { match: prior, side } = await ownMatch(platformDb(), id, actor.userId);
  const cameras = !requireCameras || await matchSupervisionReady(prior, [side]);
  let completed = false;
  const run = (competitionLocked: boolean) => withIdempotency(c, actor, `competition.match.${scope}:${id}:${number}`, body, async db => {
    await lockMatch(db, id, competitionLocked);
    const { match } = await ownMatch(db, id, actor.userId);
    requireActiveMatch(match);
    if (!matchCheckInReady(match, side)) conflict('Check in before playing a match');
    const game = await activeGame(db, id);
    if (!game || game.game_number !== number || !game.start_at) conflict('This game is no longer active');
    const [{ now }] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
    if (game.start_at > now) conflict('The game has not started');
    if (requireCameras && match.supervision === 'supervised'
      && (!cameras || supervisionKey(prior, [side]) !== supervisionKey(match, [side]))) {
      conflict('The entrant and independent supervisor must be checked in with their cameras connected');
    }
    return play({ db, match, side, game, now, save: async result => {
      const opponent = side === 'a' ? 'b' : 'a';
      const other = game[`result_${opponent}`];
      const winningSide = !other || effectiveMatchTime(result) === effectiveMatchTime(other) ? null
        : effectiveMatchTime(result) < effectiveMatchTime(other) ? side : opponent;
      const finishesMatch = winningSide !== null && match[`score_${winningSide}`] + 1 > match.best_of / 2;
      if (finishesMatch && !competitionLocked) throw new BracketLockRequired();
      await saveMatchResult(db, match, side, game, result);
      completed = finishesMatch && match.supervision === 'supervised';
    } });
  });
  const response = await run(false).catch(error => {
    if (!(error instanceof BracketLockRequired)) throw error;
    return run(true);
  });
  if (completed) void retireCompetitionVideoGeneration(id, prior.video_generation, true);
  return sendMutation(c, response);
}

async function saveMatchResult(db: PlatformDb, match: Match, side: PlayerSide, game: Game, result: MatchResult) {
  if (game[`result_${side}`]) conflict('Your result for this game has already been recorded');
  await platformQuery(db, `UPDATE platform_competition_match_games SET result_${side}=$3::jsonb WHERE match_id=$1::uuid AND game_number=$2`,
    [match.id, game.game_number, result]);
  const a = side === 'a' ? result : game.result_a;
  const b = side === 'b' ? result : game.result_b;
  if (a && b) await decideCompetitionGame(db, match, game.game_number, a, b);
}

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/phase', async c => {
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  const body = await readJsonObject(c);
  const number = integerField(body, 'gameNumber', { required: true, min: 1 })!;
  const phase = enumField(body, 'phase', ['inspecting', 'solving', 'timeout', 'disconnected'], { required: true })!;
  const inspectionMs = integerField(body, 'inspectionMs', { min: 0, max: COMPETITION_OBSERVATION_WINDOW_MS });
  return playMatch(c, actor, id, number, 'phase', body, phase !== 'disconnected' && phase !== 'timeout', async ({ db, match, side, game, now, save }) => {
    const inspectAt = game[`inspect_${side}_at`];
    const solveAt = game[`solve_${side}_at`];
    const priorResult = game[`result_${side}`];
    if (priorResult) return { status: 200, body: { inspectAt, solveAt, result: priorResult } };
    if (match.device === 'smart') {
      const inspected = inspectAt ?? game[`run_${side}_at`];
      if (phase === 'disconnected' || timingExpired(game, side, now, true)) {
        await save({ ...DNF, dnfReason: phase === 'disconnected' ? 'disconnected' : inspected ? 'solve_timeout' : 'scramble_timeout' });
        return { status: 200, body: { result: DNF } };
      }
      if (phase !== 'solving' || !inspected || solveAt) return { status: 200, body: { inspectAt: inspected, solveAt } };
      const solve = arenaSolveAt(inspected, now, inspectionMs);
      if (+solve > +now + 1000) badRequest('The inspection duration exceeds the server clock');
      await platformQuery(db, `UPDATE platform_competition_match_games SET phase_${side}='solving',inspect_${side}_at=$3,solve_${side}_at=$4
        WHERE match_id=$1::uuid AND game_number=$2`, [id, number, inspected, solve]);
      return { status: 200, body: { inspectAt: inspected, solveAt: solve } };
    }
    if (phase === 'disconnected') badRequest('This seat does not use Bluetooth timing');
    if (!timedOrdinaryGame(match, game)) {
      if (phase === 'timeout') return { status: 200, body: { inspectAt, solveAt } };
      if (game[`phase_${side}`] === 'solving') return { status: 200, body: { phase: 'solving', inspectAt, solveAt } };
      await platformQuery(db, `UPDATE platform_competition_match_games SET phase_${side}=$3 WHERE match_id=$1::uuid AND game_number=$2`,
        [id, number, phase]);
      return { status: 200, body: { phase, inspectAt, solveAt } };
    }
    if (timingExpired(game, side, now)) {
      await save(DNF);
      return { status: 200, body: { inspectAt, solveAt, result: DNF } };
    }
    if (phase === 'timeout') return { status: 200, body: { inspectAt, solveAt } };
    if (solveAt || (phase === 'inspecting' && inspectAt)) {
      return { status: 200, body: { phase: solveAt ? 'solving' : 'inspecting', inspectAt, solveAt } };
    }
    if (phase === 'solving' && !inspectAt) conflict('Start the inspection before starting the timer');
    const timestamp = phase === 'inspecting' ? 'inspect' : 'solve';
    await platformQuery(db, `UPDATE platform_competition_match_games SET phase_${side}=$3,${timestamp}_${side}_at=$4
      WHERE match_id=$1::uuid AND game_number=$2`, [id, number, phase, now]);
    return { status: 200, body: { phase, inspectAt: inspectAt ?? now, solveAt: phase === 'solving' ? now : null } };
  });
});

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/result', async c => {
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  const body = await readJsonObject(c);
  const number = integerField(body, 'gameNumber', { required: true, min: 1 })!;
  const result = validateCompetitionAttempt(body);
  if (result.penalty === 'DNS') badRequest('Use DNF for an unsuccessful game');
  return playMatch(c, actor, id, number, 'result', body, true, async ({ match, side, game, now, save }) => {
    if (match.device !== 'ordinary') conflict('Smart cube results require a verified device report');
    let official = result;
    const solveAt = game[`solve_${side}_at`];
    const timed = timedOrdinaryGame(match, game);
    if (timed && timingExpired(game, side, now)) {
      official = DNF;
    } else if (timed && result.centiseconds !== null) {
      const inspectAt = game[`inspect_${side}_at`];
      if (!inspectAt || !solveAt) conflict('Start the official timer before reporting a time');
      const penalty = inspectionPenalty(+solveAt - +inspectAt, INSPECTION_SECONDS);
      official = penalty === 'DNF' ? DNF : {
        centiseconds: result.centiseconds,
        penalty: penalty === '+2' || result.penalty === '+2' ? '+2' : 'none',
      };
    }
    if ((official.centiseconds ?? 0) * 10 > +now - +(solveAt ?? game.start_at!) + 1000) badRequest('Result exceeds the time since the solve started');
    await save(official);
    return { status: 200, body: { recorded: true, result: official } };
  });
});

function gameParams(c: Context) {
  const number = Number(c.req.param('number'));
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) badRequest('Invalid game number');
  return { id: competitionId(c.req.param('id') ?? ''), number };
}

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/games/:number/telemetry/start', async c => {
  const actor = await requirePlatformActor(c);
  const { id, number } = gameParams(c);
  const body = await readJsonObject(c);
  const issued = stringField(body, 'serverIssuedAt', { required: true, max: 64 });
  const scramble = stringField(body, 'scramble', { required: true, max: 2000 });
  const facelets = stringField(body, 'startFacelets', { required: true, min: 54, max: 54 });
  return playMatch(c, actor, id, number, 'device-start', body, true, async ({ db, match, side, game, now, save }) => {
    if (match.device !== 'smart' || game.start_at!.toISOString() !== issued || game.scramble !== scramble || game[`run_${side}`]) {
      conflict('A new smart cube run requires the current server-issued scramble');
    }
    if (game[`result_${side}`]) conflict('Your result is already recorded');
    if (timingExpired(game, side, now, true)) {
      await save({ ...DNF, dnfReason: 'scramble_timeout' });
      return { status: 200, body: { status: 'DNF' } };
    }
    if (facelets !== smartCubeTargetFacelets(scramble!)) badRequest('The cube must match the issued scramble');
    const runId = randomUUID();
    await platformQuery(db, `UPDATE platform_competition_match_games SET run_${side}=$3::uuid,run_${side}_at=$4,inspect_${side}_at=$4,phase_${side}='inspecting'
      WHERE match_id=$1::uuid AND game_number=$2`, [id, number, runId, now]);
    return { status: 201, body: { runId, status: 'started', startedAt: now } };
  });
});

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/games/:number/telemetry', async c => {
  const actor = await requirePlatformActor(c);
  const { id, number } = gameParams(c);
  const body = await readJsonObject(c);
  const report = validateCompetitionDeviceReport(body);
  return playMatch(c, actor, id, number, 'device-report', body, true, async ({ db, match, side, game, now, save }) => {
    const started = game[`run_${side}_at`];
    if (match.device !== 'smart' || game[`run_${side}`] !== report.runId || !started
      || game.start_at!.toISOString() !== report.serverIssuedAt || game.scramble !== report.scramble) conflict('The device report does not match the active game');
    const solve = arenaSolveAt(started, now, report.inspectionMs);
    const reason = arenaDnfReason(game.start_at!, started, game[`solve_${side}_at`] ?? solve, now);
    if (reason || report.disconnected) {
      await save({ ...DNF, dnfReason: reason ?? 'disconnected' });
      return { status: 200, body: { status: 'DNF' } };
    }
    if (report.inspectionMs === undefined) badRequest('The report must include the observation duration');
    if (game[`solve_${side}_at`] && Math.abs(+game[`solve_${side}_at`]! - +solve) > 2) badRequest('The reported inspection does not match the recorded start');
    if (report.durationMs + (report.inspectionMs ?? 0) > now.getTime() - started.getTime() + 1000) badRequest('The report exceeds the time since the device run started');
    if (!report.disconnected) verifyCompletedCompetitionDeviceReport(report);
    await platformQuery(db, `UPDATE platform_competition_match_games SET report_${side}=$3::jsonb WHERE match_id=$1::uuid AND game_number=$2`, [id, number, { ...report, timestamp: now.toISOString() }]);
    await save(competitionDeviceResult(report));
    return { status: 201, body: { status: 'device_reported' } };
  });
});

platformCompetitionBracketRoutes.get('/platform/competitions/matches/:id/games/:number/telemetry', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const { id, number } = gameParams(c);
  const { side } = await ownMatch(platformDb(), id, actor.userId);
  const other = side === 'a' ? 'b' : 'a';
  const [game] = await platformQuery<{
    own_report: ReturnType<typeof validateCompetitionDeviceReport> | null;
    opponent_report: ReturnType<typeof validateCompetitionDeviceReport> | null;
    own_result: MatchResult | null; opponent_result: MatchResult | null;
    resolved_at: Date | null;
  }>(platformDb(), `SELECT report_${side} AS own_report,report_${other} AS opponent_report,
    result_${side} AS own_result,result_${other} AS opponent_result,resolved_at
    FROM platform_competition_match_games WHERE match_id=$1::uuid AND game_number=$2`, [id, number]);
  if (!game || !game.own_result) notFound('Completed game');
  return c.json({
    own: competitionReplay(game.own_report, game.resolved_at, game.own_result.penalty),
    opponent: game.resolved_at ? competitionReplay(game.opponent_report, game.resolved_at, game.opponent_result?.penalty) : null,
  });
});

async function expireMatchGame(db: PlatformDb, match: Match, smart: boolean) {
  const game = await activeGame(db, match.id);
  const [{ now }] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
  if (!game || !gameNeedsExpiry(game, now, smart)) return false;
  for (const side of PLAYER_SIDES) {
    if (game[`result_${side}`] || !timingExpired(game, side, now, smart)) continue;
    const result = { ...DNF, dnfReason: game[`inspect_${side}_at`] || game[`run_${side}_at`] ? 'solve_timeout' : 'scramble_timeout' } as const;
    await saveMatchResult(db, match, side, game, result);
    game[`result_${side}`] = result;
  }
  const [current] = await platformQuery<{ status: string }>(db, 'SELECT status FROM platform_competition_matches WHERE id=$1', [match.id]);
  return current.status === 'completed';
}

async function closeNoShowMatch(db: PlatformDb, match: SeatMatch) {
  const deadline = noShowDeadline(match);
  const [{ now }] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
  if (!deadline || now < deadline || +now < +match.event_starts_at) return false;
  const game = await activeGame(db, match.id);
  if (game?.start_at) return false;
  const a = readyForWalkover(match, game, 'a');
  const b = readyForWalkover(match, game, 'b');
  if (a && b) return false;
  const winner = a ? match.player_a_registration_id : b ? match.player_b_registration_id : null;
  if (game) await platformQuery(db, `UPDATE platform_competition_match_games SET resolved_at=clock_timestamp()
    WHERE match_id=$1 AND game_number=$2`, [match.id, game.game_number]);
  await finishCompetitionMatch(db, match, winner, true, winner ? 'no_show' : 'double_no_show');
  await resolveCompetitionBracketSlots(db, match.event_id);
  return true;
}

export async function closeExpiredCompetitionGames(db: PlatformDb) {
  const deadline = (side: PlayerSide) => `CASE WHEN t.competition_device='smart' THEN
    COALESCE(g.solve_${side}_at,COALESCE(g.inspect_${side}_at,g.run_${side}_at)+$2*INTERVAL '1 millisecond',g.start_at)+$1*INTERVAL '1 millisecond'
    ELSE COALESCE(g.solve_${side}_at+$1*INTERVAL '1 millisecond',g.inspect_${side}_at+INTERVAL '17 seconds',g.start_at+$1*INTERVAL '1 millisecond') END`;
  const expired = `(m.status='in_progress' AND g.start_at IS NOT NULL
      AND (t.competition_device='smart' OR g.authoritative_timing)
      AND ((g.result_a IS NULL AND ${deadline('a')}<=clock_timestamp())
        OR (g.result_b IS NULL AND ${deadline('b')}<=clock_timestamp())))
    OR (m.status='ready' AND m.ready_at IS NOT NULL AND g.start_at IS NULL
      AND GREATEST(m.ready_at,e.starts_at)+${COMPETITION_MATCH_NO_SHOW_MS}*INTERVAL '1 millisecond'<=clock_timestamp()
      AND (g.ready_a_at IS NULL OR g.ready_b_at IS NULL OR a.status<>'confirmed' OR b.status<>'confirmed'
        OR (c.supervision_mode<>'offline' AND (a.checked_in_at IS NULL OR b.checked_in_at IS NULL))
        OR ${competitionCheckInWindow('sa')} IS NOT TRUE OR ${competitionCheckInWindow('sb')} IS NOT TRUE))`;
  const candidates = `FROM platform_competition_matches m JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id
    JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
    JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
    LEFT JOIN platform_competition_sessions sa ON sa.id=a.competition_session_id
    LEFT JOIN platform_competition_sessions sb ON sb.id=b.competition_session_id
    LEFT JOIN platform_competition_match_games g ON g.match_id=m.id AND g.resolved_at IS NULL
    WHERE m.event_id=c.event_id AND (${expired})`;
  const limits = [COMPETITION_STAGE_LIMIT_MS, COMPETITION_OBSERVATION_WINDOW_MS];
  const [event] = await platformQuery<{ id: string }>(db, `SELECT c.event_id::text AS id FROM platform_competitions c
    JOIN platform_events e ON e.id=c.event_id
    WHERE c.competition_format='advancement' AND e.status='published' AND e.ends_at>clock_timestamp()
      AND EXISTS(SELECT 1 ${candidates})
    ORDER BY e.ends_at,c.event_id LIMIT 1 FOR UPDATE OF c SKIP LOCKED`, limits);
  if (!event) return [];
  const rows = await platformQuery<{ id: string }>(db, `SELECT expired.id::text FROM platform_competitions c
    JOIN platform_events e ON e.id=c.event_id CROSS JOIN LATERAL(SELECT m.id ${candidates}) expired
    WHERE e.id=$3::uuid ORDER BY expired.id LIMIT 32`, [...limits, event.id]);
  const retired: Match[] = [];
  for (const { id } of rows) {
    await lockMatch(db, id);
    const [match] = await platformQuery<SeatMatch>(db, MATCH_DETAILS, [id]);
    if (!match.eligible) continue;
    const completed = match.status === 'ready' ? await closeNoShowMatch(db, match)
      : match.status === 'in_progress' && await expireMatchGame(db, match, match.device === 'smart');
    if (completed && match.supervision === 'supervised') retired.push(match);
  }
  return retired;
}

export function startCompetitionBracketScheduling() {
  let generating = false;
  let starting = false;
  let settling = false;
  const generate = async () => {
    if (generating) return;
    generating = true;
    try {
      await platformTransaction(async db => {
        const [event] = await platformQuery<{ id: string }>(db, `SELECT e.id::text
          FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
          WHERE c.competition_format='advancement' AND c.brackets_generated_at IS NULL AND e.status='published'
            AND c.registration_closes_at<=NOW() AND e.ends_at>NOW() AND ${NO_PENDING_COMPETITION_REGISTRATIONS}
          ORDER BY c.registration_closes_at LIMIT 1 FOR UPDATE OF c SKIP LOCKED`);
        if (event) await generateCompetitionBrackets(db, event.id);
      });
    } catch (error) { console.warn('Competition bracket generation failed', error); }
    finally { generating = false; }
  };
  const start = async () => {
    if (starting) return;
    starting = true;
    try { await startReadyCompetitionGames(); }
    catch (error) { console.warn('Competition match start failed', error); }
    finally { starting = false; }
  };
  const settle = async () => {
    if (settling) return;
    settling = true;
    try {
      const retired = await platformTransaction(closeExpiredCompetitionGames);
      for (const match of retired) void retireCompetitionVideoGeneration(match.id, match.video_generation, true);
      await platformTransaction(sweepCompetitionArenas);
    } catch (error) { console.warn('Competition timeout settlement failed', error); }
    finally { settling = false; }
  };
  setInterval(() => void generate(), 1000).unref();
  setInterval(() => void start(), 1000).unref();
  setInterval(() => void settle(), 1000).unref();
}
