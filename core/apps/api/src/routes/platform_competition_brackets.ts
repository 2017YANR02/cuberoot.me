import { inspectionPenalty } from '@cuberoot/shared/timer';
import type { Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { requirePlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, platformTransaction, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { enumField, integerField, readJsonObject, stringField } from '../platform/validation.js';
import { requireCompetitionManager, validateCompetitionAttempt } from '../platform/competitions.js';
import { decideCompetitionGame, generateCompetitionBrackets, type Match, type MatchResult } from '../platform/competition_brackets.js';
import { competitionId, competitionScramble } from '../platform/competition_workflow.js';
import { competitionDeviceResult, validateCompetitionDeviceReport, verifyCompletedCompetitionDeviceReport } from '../platform/competition_device_reports.js';
import { competitionSupervisionReady } from './video_rooms.js';

export const platformCompetitionBracketRoutes = platformRouter();

const SCRAMBLE_LIMIT_MS = 60_000;
const INSPECTION_SECONDS = 15;
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
  supervision: string; a_checked: boolean; b_checked: boolean;
  a_supervisor: string | null; b_supervisor: string | null;
  a_video: string | null; b_video: string | null;
};
const MATCH_DETAILS = `SELECT m.*,t.competition_project AS project,t.competition_device AS device,
    a.user_id::text AS a_user,b.user_id::text AS b_user,a.status AS a_status,b.status AS b_status,
    c.supervision_mode AS supervision,
    (a.checked_in_at IS NOT NULL AND sa.starts_at<=NOW() AND sa.ends_at>NOW()) AS a_checked,
    (b.checked_in_at IS NOT NULL AND sb.starts_at<=NOW() AND sb.ends_at>NOW()) AS b_checked,
    sa.supervisor_user_id::text AS a_supervisor,sb.supervisor_user_id::text AS b_supervisor,
    a.competition_video_generation::text AS a_video,b.competition_video_generation::text AS b_video,
    COALESCE(ao.buyer_display_name_snapshot,'') AS title_a,COALESCE(bo.buyer_display_name_snapshot,'') AS title_b,
    (e.status='published' AND e.starts_at<=NOW() AND e.ends_at>NOW()) AS eligible
  FROM platform_competition_matches m JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id
  JOIN platform_events e ON e.id=m.event_id
  JOIN platform_competitions c ON c.event_id=m.event_id
  LEFT JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
  LEFT JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
  LEFT JOIN platform_competition_sessions sa ON sa.id=a.competition_session_id
  LEFT JOIN platform_competition_sessions sb ON sb.id=b.competition_session_id
  LEFT JOIN platform_order_items ai ON ai.id=a.order_item_id LEFT JOIN platform_orders ao ON ao.id=ai.order_id
  LEFT JOIN platform_order_items bi ON bi.id=b.order_item_id LEFT JOIN platform_orders bo ON bo.id=bi.order_id
  WHERE m.id=$1::uuid`;

async function ownMatch(db: PlatformDb, id: string, userId: number | null, lock = false) {
  if (lock) await platformQuery(db, `SELECT c.event_id FROM platform_competition_matches m JOIN platform_competitions c ON c.event_id=m.event_id
    WHERE m.id=$1::uuid FOR UPDATE OF c`, [id]);
  const [match] = await platformQuery<SeatMatch>(db, MATCH_DETAILS, [id]);
  if (!match) notFound('Match');
  const side: PlayerSide | null = userId != null && match.a_user === String(userId) ? 'a' : userId != null && match.b_user === String(userId) ? 'b' : null;
  if (side === null) forbidden('Only the participants may open this match seat');
  return { match, side };
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

function timingExpired(game: Game, side: PlayerSide, now: Date) {
  if (!game.start_at || game[`solve_${side}_at`]) return false;
  const inspected = game[`inspect_${side}_at`];
  return inspected ? inspectionPenalty(+now - +inspected, INSPECTION_SECONDS) === 'DNF'
    : +now - +game.start_at > SCRAMBLE_LIMIT_MS;
}

function requireActiveMatch(match: SeatMatch) {
  if (!match.eligible || !['ready', 'in_progress'].includes(match.status) || match.a_status !== 'confirmed' || match.b_status !== 'confirmed') {
    conflict('Both entrants must have an active registration in a playable match');
  }
}

async function requireMatchSupervision(match: SeatMatch, sides: readonly ('a' | 'b')[]) {
  if (match.supervision !== 'supervised') return;
  const cameras = await Promise.all(sides.map(side => {
    const registrationId = side === 'a' ? match.player_a_registration_id : match.player_b_registration_id;
    const supervisor = match[`${side}_supervisor`];
    const user = match[`${side}_user`];
    const generation = match[`${side}_video`];
    if (!match[`${side}_checked`] || !registrationId || !supervisor || !user || supervisor === user || !generation) return false;
    return competitionSupervisionReady(registrationId, generation, Number(user), Number(supervisor));
  }));
  if (cameras.some(ready => !ready)) conflict('The entrant and independent supervisor must be checked in with their cameras connected');
}

const NO_PENDING_REGISTRATIONS = `NOT EXISTS (
  SELECT 1 FROM platform_event_registrations r WHERE r.event_id=c.event_id
    AND r.status='reserved' AND r.reservation_expires_at>NOW()
)`;
async function generationWindow(db: PlatformDb, eventId: string) {
  const [row] = await platformQuery<{ eligible: boolean; generated: boolean }>(db, `
    SELECT e.status='published' AND c.competition_format='advancement' AND c.registration_closes_at<=NOW() AND ${NO_PENDING_REGISTRATIONS} AS eligible,
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
  }));
});

platformCompetitionBracketRoutes.get('/platform/competitions/:id/brackets', async c => {
  privateNoStore(c);
  const eventId = competitionId(c.req.param('id'));
  const [event] = await platformQuery<{ generated: boolean }>(platformDb(), `SELECT c.brackets_generated_at IS NOT NULL AS generated
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
    WHERE c.event_id=$1::uuid AND c.competition_format='advancement' AND e.status IN ('published','completed')`, [eventId]);
  if (!event) notFound('Competition bracket');
  const [matches, standings] = await Promise.all([
    platformQuery(platformDb(), `SELECT m.id::text,m.ticket_type_id::text AS "ticketId",
      t.competition_project AS project,t.competition_device AS device,
      m.bracket_side AS side,m.round_number AS round,m.match_number AS number,m.best_of AS "bestOf",
      m.player_a_registration_id::text AS "playerA",m.player_b_registration_id::text AS "playerB",
      ao.buyer_display_name_snapshot AS "nameA",bo.buyer_display_name_snapshot AS "nameB",
      m.score_a AS "scoreA",m.score_b AS "scoreB",m.winner_registration_id::text AS winner,m.status,
      CASE WHEN m.status='in_progress' THEN (SELECT COALESCE(
        MAX(g.game_number) FILTER (WHERE g.resolved_at IS NULL),MAX(g.game_number)+1,1)
        FROM platform_competition_match_games g WHERE g.match_id=m.id) END AS "gameNumber",
      m.next_win_match_id::text AS "nextWin",m.next_loss_match_id::text AS "nextLoss"
      FROM platform_competition_matches m JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id
      LEFT JOIN platform_event_registrations a ON a.id=m.player_a_registration_id
      LEFT JOIN platform_event_registrations b ON b.id=m.player_b_registration_id
      LEFT JOIN platform_order_items ai ON ai.id=a.order_item_id LEFT JOIN platform_orders ao ON ao.id=ai.order_id
      LEFT JOIN platform_order_items bi ON bi.id=b.order_item_id LEFT JOIN platform_orders bo ON bo.id=bi.order_id
      WHERE m.event_id=$1::uuid ORDER BY m.bracket_side,m.round_number,m.match_number`, [eventId]),
    platformQuery(platformDb(), `WITH participants AS (
      SELECT m.id,m.ticket_type_id,m.bracket_side,m.round_number,m.status,m.winner_registration_id,
        p.registration_id,p.slot
      FROM platform_competition_matches m JOIN LATERAL (VALUES (m.player_a_registration_id,'a'),(m.player_b_registration_id,'b')) AS p(registration_id,slot) ON true
      WHERE m.event_id=$1::uuid AND p.registration_id IS NOT NULL
    ), totals AS (
      SELECT p.registration_id,p.ticket_type_id,
        COUNT(*) FILTER (WHERE g.winner_registration_id=p.registration_id)::integer AS wins,
        MAX(p.round_number) AS depth,
        MAX(g.resolved_at) AS "recordedAt",
        MIN(CASE WHEN result->>'penalty' IN ('none','+2') THEN (result->>'centiseconds')::integer +
          CASE WHEN result->>'penalty'='+2' THEN 200 ELSE 0 END END) AS best,
        MIN(CASE WHEN p.bracket_side='grand_final' AND p.status IN ('completed','bye') AND p.winner_registration_id IS NOT NULL
          THEN CASE WHEN p.winner_registration_id=p.registration_id THEN 1 ELSE 2 END
          WHEN p.bracket_side='losers' AND p.status='completed' AND p.winner_registration_id<>p.registration_id
            AND p.round_number=(SELECT MAX(last.round_number) FROM platform_competition_matches last WHERE last.ticket_type_id=p.ticket_type_id AND last.bracket_side='losers')
          THEN 3 END) AS podium
      FROM participants p LEFT JOIN platform_competition_match_games g ON g.match_id=p.id
      LEFT JOIN LATERAL (SELECT CASE WHEN p.slot='a' THEN g.result_a ELSE g.result_b END AS result) result_row ON true
      GROUP BY p.registration_id,p.ticket_type_id
    )
    SELECT r.id::text,r.ticket_type_id::text AS "ticketId",o.buyer_display_name_snapshot AS name,u.wca_id AS "wcaId",CASE WHEN u.wca_id IS NOT NULL THEN u.country_iso2 END AS "countryCode",
      COALESCE(t.wins,0) AS wins,t.best,t."recordedAt",
      ROW_NUMBER() OVER (PARTITION BY r.ticket_type_id ORDER BY t.podium NULLS LAST,t.wins DESC NULLS LAST,
        t.depth DESC NULLS LAST,t.best NULLS LAST,r.created_at,r.id)::integer AS rank
    FROM platform_event_registrations r
    JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
    LEFT JOIN app_users u ON u.id=r.user_id LEFT JOIN totals t ON t.registration_id=r.id
    WHERE r.event_id=$1::uuid AND r.status IN ('confirmed','attended')`, [eventId]),
  ]);
  return c.json({ generated: event.generated, matches, standings: event.generated ? standings : [] });
});

platformCompetitionBracketRoutes.get('/platform/competitions/matches/:id', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  const { match, side } = await ownMatch(platformDb(), id, actor.userId);
  // Scores, the active game, and the prior result must come from the same snapshot.
  type SettledGame = Pick<Game, 'game_number' | 'result_a' | 'result_b'> & { winner_registration_id: string | null };
  const [snapshot] = await platformQuery<{
    now: Date; status: string; score_a: number; score_b: number;
    active: (Omit<Game, 'start_at' | 'inspect_a_at' | 'inspect_b_at' | 'solve_a_at' | 'solve_b_at'> & {
      start_at: string | null; inspect_a_at: string | null; inspect_b_at: string | null; solve_a_at: string | null; solve_b_at: string | null;
    }) | null; last: SettledGame | null;
  }>(platformDb(), `SELECT clock_timestamp() AS now,m.status,m.score_a,m.score_b,
    (SELECT to_jsonb(g) FROM (
      SELECT ${GAME_FIELDS} FROM platform_competition_match_games WHERE match_id=m.id AND resolved_at IS NULL ORDER BY game_number DESC LIMIT 1
    ) g) AS active,
    (SELECT to_jsonb(g) FROM (
      SELECT game_number,result_a,result_b,winner_registration_id FROM platform_competition_match_games
      WHERE match_id=m.id AND resolved_at IS NOT NULL ORDER BY game_number DESC LIMIT 1
    ) g) AS last
    FROM platform_competition_matches m WHERE m.id=$1::uuid`, [id]);
  const { active: game, last, now } = snapshot;
  const opponent = side === 'a' ? 'b' : 'a';
  const registrationId = side === 'a' ? match.player_a_registration_id : match.player_b_registration_id;
  const iso = (timestamp: string | null) => timestamp ? new Date(timestamp).toISOString() : null;
  const activeGame = game ? {
    gameNumber: game.game_number,
    startAt: iso(game.start_at),
    scramble: game.start_at && new Date(game.start_at) <= now ? game.scramble : null,
    ownReady: !!game[`ready_${side}_at`], opponentReady: !!game[`ready_${opponent}_at`],
    ownResult: game[`result_${side}`], opponentFinished: !!game[`result_${opponent}`],
    opponentPhase: game[`phase_${opponent}`],
    runId: game[`run_${side}`],
    authoritativeTiming: timedOrdinaryGame(match, game),
    inspectAt: iso(game[`inspect_${side}_at`]), solveAt: iso(game[`solve_${side}_at`]),
    scrambleDeadlineAt: game.start_at ? new Date(+new Date(game.start_at) + SCRAMBLE_LIMIT_MS) : null,
    inspectionSeconds: INSPECTION_SECONDS,
  } : null;
  return c.json({
    id, eventId: match.event_id, project: match.project, device: match.device, status: snapshot.status,
    registrationId,
    supervisionMode: match.supervision, requiresSupervision: match.supervision === 'supervised', checkedIn: !!match[`${side}_checked`],
    ownName: side === 'a' ? match.title_a : match.title_b, opponentName: side === 'a' ? match.title_b : match.title_a,
    ownScore: side === 'a' ? snapshot.score_a : snapshot.score_b, opponentScore: side === 'a' ? snapshot.score_b : snapshot.score_a,
    serverNow: now,
    canPlay: match.eligible && match.a_status === 'confirmed' && match.b_status === 'confirmed',
    gameNumber: activeGame?.gameNumber ?? ((last?.game_number ?? 0) + 1),
    startAt: activeGame?.startAt ?? null, scramble: activeGame?.scramble ?? null,
    ownReady: activeGame?.ownReady ?? false, opponentReady: activeGame?.opponentReady ?? false,
    ownResult: activeGame?.ownResult ?? null, opponentFinished: activeGame?.opponentFinished ?? false,
    opponentPhase: activeGame?.opponentPhase ?? null, runId: activeGame?.runId ?? null,
    activeGame,
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
  return sendMutation(c, await withIdempotency(c, actor, `competition.match.ready:${id}:${number}`, body, async db => {
    const { match, side } = await ownMatch(db, id, actor.userId, true);
    requireActiveMatch(match);
    const game = await activeGame(db, id);
    if (game && game.game_number !== number) conflict('This game is no longer current');
    await requireMatchSupervision(match, game && !game[`ready_${side}_at`] ? ['a', 'b'] : [side]);
    if (!game) {
      const [next] = await platformQuery<{ number: number }>(db, `SELECT COALESCE(MAX(game_number),0)::integer+1 AS number
        FROM platform_competition_match_games WHERE match_id=$1::uuid`, [id]);
      if (next.number !== number) conflict('This game is no longer current');
      await platformQuery(db, `INSERT INTO platform_competition_match_games(match_id,game_number,ready_${side}_at)
        VALUES($1::uuid,$2,clock_timestamp())`, [id, number]);
    } else if (!game[`ready_${side}_at`]) {
      const scramble = await competitionScramble(match.project);
      await platformQuery(db, `UPDATE platform_competition_match_games SET ready_${side}_at=clock_timestamp(),
        start_at=clock_timestamp()+INTERVAL '3 seconds',scramble=$3 WHERE match_id=$1::uuid AND game_number=$2`, [id, number, scramble]);
      await platformQuery(db, `UPDATE platform_competition_matches SET status='in_progress' WHERE id=$1::uuid`, [id]);
    }
    return { status: 200, body: { ready: true } };
  }));
});

async function playableGame(db: PlatformDb, id: string, userId: number | null, number: number) {
  const { match, side } = await ownMatch(db, id, userId, true);
  requireActiveMatch(match);
  const game = await activeGame(db, id);
  if (!game || game.game_number !== number || !game.start_at) conflict('This game is no longer active');
  const [clock] = await platformQuery<{ now: Date }>(db, 'SELECT clock_timestamp() AS now');
  if (game.start_at > clock.now) conflict('The game has not started');
  await requireMatchSupervision(match, [side]);
  return { match, side, game, now: clock.now };
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
  const phase = enumField(body, 'phase', ['inspecting', 'solving', 'timeout'], { required: true })!;
  return sendMutation(c, await withIdempotency(c, actor, `competition.match.phase:${id}:${number}`, body, async db => {
    const { match, side, game, now } = await playableGame(db, id, actor.userId, number);
    const inspectAt = game[`inspect_${side}_at`];
    const solveAt = game[`solve_${side}_at`];
    const priorResult = game[`result_${side}`];
    if (priorResult) return { status: 200, body: { inspectAt, solveAt, result: priorResult } };
    if (!timedOrdinaryGame(match, game)) {
      if (phase === 'timeout') return { status: 200, body: { inspectAt, solveAt } };
      if (game[`phase_${side}`] === 'solving') return { status: 200, body: { phase: 'solving', inspectAt, solveAt } };
      await platformQuery(db, `UPDATE platform_competition_match_games SET phase_${side}=$3 WHERE match_id=$1::uuid AND game_number=$2`,
        [id, number, phase]);
      return { status: 200, body: { phase, inspectAt, solveAt } };
    }
    if (timingExpired(game, side, now)) {
      await saveMatchResult(db, match, side, game, DNF);
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
  }));
});

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/result', async c => {
  const actor = await requirePlatformActor(c);
  const id = competitionId(c.req.param('id'));
  const body = await readJsonObject(c);
  const number = integerField(body, 'gameNumber', { required: true, min: 1 })!;
  const result = validateCompetitionAttempt(body);
  if (result.penalty === 'DNS') badRequest('Use DNF for an unsuccessful game');
  return sendMutation(c, await withIdempotency(c, actor, `competition.match.result:${id}:${number}`, body, async db => {
    const { match, side, game, now } = await playableGame(db, id, actor.userId, number);
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
    await saveMatchResult(db, match, side, game, official);
    return { status: 200, body: { recorded: true, result: official } };
  }));
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
  return sendMutation(c, await withIdempotency(c, actor, `competition.match.device-start:${id}:${number}`, body, async db => {
    const { match, side, game } = await playableGame(db, id, actor.userId, number);
    if (match.device !== 'smart' || game.start_at!.toISOString() !== issued || game.scramble !== scramble || game[`run_${side}`]) {
      conflict('A new smart cube run requires the current server-issued scramble');
    }
    const runId = randomUUID();
    await platformQuery(db, `UPDATE platform_competition_match_games SET run_${side}=$3::uuid,run_${side}_at=clock_timestamp(),phase_${side}='inspecting'
      WHERE match_id=$1::uuid AND game_number=$2`, [id, number, runId]);
    return { status: 201, body: { runId, status: 'started' } };
  }));
});

platformCompetitionBracketRoutes.post('/platform/competitions/matches/:id/games/:number/telemetry', async c => {
  const actor = await requirePlatformActor(c);
  const { id, number } = gameParams(c);
  const body = await readJsonObject(c);
  const report = validateCompetitionDeviceReport(body);
  return sendMutation(c, await withIdempotency(c, actor, `competition.match.device-report:${id}:${number}`, body, async db => {
    const { match, side, game, now } = await playableGame(db, id, actor.userId, number);
    const started = game[`run_${side}_at`];
    if (match.device !== 'smart' || game[`run_${side}`] !== report.runId || !started
      || game.start_at!.toISOString() !== report.serverIssuedAt || game.scramble !== report.scramble) conflict('The device report does not match the active game');
    if (report.durationMs + (report.inspectionMs ?? 0) > now.getTime() - started.getTime() + 1000) badRequest('The report exceeds the time since the device run started');
    if (!report.disconnected) verifyCompletedCompetitionDeviceReport(report);
    await platformQuery(db, `UPDATE platform_competition_match_games SET report_${side}=$3::jsonb WHERE match_id=$1::uuid AND game_number=$2`, [id, number, report]);
    await saveMatchResult(db, match, side, game, competitionDeviceResult(report));
    return { status: 201, body: { status: 'device_reported' } };
  }));
});

export async function closeExpiredOrdinaryGames(db: PlatformDb) {
  const expired = `g.authoritative_timing AND g.resolved_at IS NULL AND g.start_at IS NOT NULL
    AND ((g.result_a IS NULL AND g.solve_a_at IS NULL AND clock_timestamp()>COALESCE(
      g.inspect_a_at+make_interval(secs=>$2),g.start_at+make_interval(secs=>$1)))
    OR (g.result_b IS NULL AND g.solve_b_at IS NULL AND clock_timestamp()>COALESCE(
      g.inspect_b_at+make_interval(secs=>$2),g.start_at+make_interval(secs=>$1))))`;
  const limits = [SCRAMBLE_LIMIT_MS / 1000, INSPECTION_SECONDS + 2];
  const [competition] = await platformQuery<{ id: string; now: Date }>(db, `SELECT c.event_id::text AS id,clock_timestamp() AS now
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
    WHERE c.competition_format='advancement' AND e.status='published' AND e.ends_at>NOW()
      AND EXISTS(SELECT 1 FROM platform_competition_matches m
        JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id AND t.competition_device='ordinary'
        JOIN platform_competition_match_games g ON g.match_id=m.id
        WHERE m.event_id=c.event_id AND m.status='in_progress' AND ${expired})
    ORDER BY e.ends_at,c.event_id LIMIT 1 FOR UPDATE OF c SKIP LOCKED`, limits);
  if (!competition) return;
  const matches = await platformQuery<Match>(db, `SELECT m.* FROM platform_competition_matches m
    JOIN platform_event_ticket_types t ON t.id=m.ticket_type_id AND t.competition_device='ordinary'
    JOIN platform_competition_match_games g ON g.match_id=m.id
    WHERE m.event_id=$3::uuid AND m.status='in_progress' AND ${expired}
    ORDER BY g.start_at,m.id LIMIT 32`, [...limits, competition.id]);
  for (const match of matches) {
    const game = await activeGame(db, match.id);
    if (!game) continue;
    for (const side of ['a', 'b'] as const) {
      if (game[`result_${side}`] || !timingExpired(game, side, competition.now)) continue;
      await saveMatchResult(db, match, side, game, DNF);
      game[`result_${side}`] = DNF;
    }
  }
}

export function startCompetitionBracketScheduling() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await platformTransaction(async db => {
        const [event] = await platformQuery<{ id: string }>(db, `SELECT e.id::text
          FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
          WHERE c.competition_format='advancement' AND c.brackets_generated_at IS NULL AND e.status='published'
            AND c.registration_closes_at<=NOW() AND e.ends_at>NOW() AND ${NO_PENDING_REGISTRATIONS}
          ORDER BY c.registration_closes_at LIMIT 1 FOR UPDATE OF c SKIP LOCKED`);
        if (event) await generateCompetitionBrackets(db, event.id);
      });
      await platformTransaction(closeExpiredOrdinaryGames);
    } catch (error) { console.warn('Competition bracket generation failed', error); }
    finally { running = false; }
  };
  setInterval(() => void tick(), 15_000).unref();
}
