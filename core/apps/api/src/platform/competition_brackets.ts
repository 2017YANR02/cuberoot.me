import { randomUUID } from 'node:crypto';
import { conflict } from './errors.js';
import { platformQuery, type PlatformDb } from './db.js';
import { competitionResultSummary, type validateCompetitionAttempt } from './competitions.js';

type Side = 'winners' | 'losers' | 'grand_final';
type Slot = 1 | 2;
type Link = { matchId: string; slot: Slot };
type MatchDraft = {
  id: string; side: Side; round: number; number: number; bestOf: 3 | 5;
  a: string | null; b: string | null; seeded: boolean; win?: Link; loss?: Link;
};
export type Match = {
  id: string; event_id: string; ticket_type_id: string; bracket_side: Side; best_of: number;
  player_a_registration_id: string | null; player_b_registration_id: string | null;
  next_win_match_id: string | null; next_win_slot: Slot | null;
  next_loss_match_id: string | null; next_loss_slot: Slot | null;
  score_a: number; score_b: number; status: string;
};
export type MatchResult = ReturnType<typeof validateCompetitionAttempt>;

function foldedSeedOrder(size: number) {
  let order = [1, 2];
  for (let count = 4; count <= size; count *= 2) {
    order = order.flatMap(seed => [seed, count + 1 - seed]);
  }
  return order;
}

/** Every edge resolves a slot exactly once, including vacant seats propagated from byes. */
function bracketFor(entrants: readonly string[]): MatchDraft[] {
  const rounds = Math.ceil(Math.log2(entrants.length));
  const size = 2 ** rounds;
  const seedOrder = foldedSeedOrder(size);
  const makeRound = (side: Side, round: number, count: number): MatchDraft[] =>
    Array.from({ length: count }, (_, i) => ({
      id: randomUUID(), side, round, number: i + 1, bestOf: side === 'grand_final' ? 5 : 3,
      a: null, b: null, seeded: false,
    }));
  const winners = Array.from({ length: rounds }, (_, i) => makeRound('winners', i + 1, size / 2 ** (i + 1)));
  const losers: MatchDraft[][] = [];
  for (let r = 0; r < rounds - 1; r++) {
    const count = size / 2 ** (r + 2);
    losers.push(makeRound('losers', losers.length + 1, count));
    losers.push(makeRound('losers', losers.length + 1, count));
  }
  const grand = makeRound('grand_final', 1, 1)[0];
  winners[0].forEach((match, i) => {
    match.seeded = true;
    match.a = entrants[seedOrder[2 * i] - 1] ?? null;
    match.b = entrants[seedOrder[2 * i + 1] - 1] ?? null;
    match.loss = rounds === 1 ? { matchId: grand.id, slot: 2 } : { matchId: losers[0][i >> 1].id, slot: i % 2 ? 2 : 1 };
  });
  winners.forEach((round, r) => round.forEach((match, i) => {
    match.win = r === rounds - 1 ? { matchId: grand.id, slot: 1 } : { matchId: winners[r + 1][i >> 1].id, slot: i % 2 ? 2 : 1 };
    if (r > 0) {
      const dropRound = losers[2 * r - 1];
      // Cross adjacent matches so a first-round pair does not immediately meet again.
      match.loss = { matchId: dropRound[dropRound.length > 1 ? i ^ 1 : i].id, slot: 2 };
    }
  }));
  losers.forEach((round, r) => round.forEach((match, i) => {
    if (r === losers.length - 1) match.win = { matchId: grand.id, slot: 2 };
    else if (r % 2 === 0) match.win = { matchId: losers[r + 1][i].id, slot: 1 };
    else match.win = { matchId: losers[r + 1][i >> 1].id, slot: i % 2 ? 2 : 1 };
  }));
  // Targets are inserted before any references that point to them.
  return [grand, ...losers.reverse().flat(), ...winners.reverse().flat()];
}

async function fillSlot(db: PlatformDb, target: string | null, slot: Slot | null, registration: string | null) {
  if (!target || !slot) return;
  const suffix = slot === 1 ? 'a' : 'b';
  const [row] = await platformQuery(db, `UPDATE platform_competition_matches
    SET player_${suffix}_registration_id=$2::uuid,slot_${suffix}_resolved=TRUE
    WHERE id=$1::uuid AND status='pending' AND NOT slot_${suffix}_resolved RETURNING id`, [target, registration]);
  if (!row) conflict('The bracket slot was already assigned');
}

export async function advanceCompetitionMatch(db: PlatformDb, match: Match, winner: string | null, loser: string | null) {
  await fillSlot(db, match.next_win_match_id, match.next_win_slot, winner);
  await fillSlot(db, match.next_loss_match_id, match.next_loss_slot, loser);
}

export async function resolveCompetitionBracketSlots(db: PlatformDb, eventId: string) {
  // A vacant slot can propagate down several levels. Unresolved upstream slots stay pending.
  for (;;) {
    const ready = await platformQuery<Match>(db, `UPDATE platform_competition_matches
      SET status=CASE WHEN player_a_registration_id IS NOT NULL AND player_b_registration_id IS NOT NULL THEN 'ready' ELSE 'bye' END,
        winner_registration_id=CASE WHEN player_a_registration_id IS NULL OR player_b_registration_id IS NULL
          THEN COALESCE(player_a_registration_id,player_b_registration_id) END
      WHERE event_id=$1::uuid AND status='pending' AND slot_a_resolved AND slot_b_resolved RETURNING *`, [eventId]);
    const byes = ready.filter(match => match.status === 'bye');
    if (!byes.length) return;
    for (const match of byes) {
      await advanceCompetitionMatch(db, match, match.player_a_registration_id ?? match.player_b_registration_id, null);
    }
  }
}

/** Caller holds the event's platform_competitions row lock. */
export async function generateCompetitionBrackets(db: PlatformDb, eventId: string) {
  const [existing] = await platformQuery(db, 'SELECT id FROM platform_competition_matches WHERE event_id=$1::uuid LIMIT 1', [eventId]);
  if (existing) return false;
  const [official] = await platformQuery<{ available: boolean }>(db,
    "SELECT to_regclass('wca_person_results') IS NOT NULL AS available");
  const registrations = await platformQuery<{ id: string; user_id: string; ticket_type_id: string; project: string; device: string; official_average: number | null }>(db, `
    SELECT r.id::text,r.user_id::text,r.ticket_type_id::text,t.competition_project AS project,t.competition_device AS device,
      ${official?.available ? `(SELECT MIN(w.average) FROM wca_person_results w
        WHERE w.wca_id=u.wca_id AND w.event_id=t.competition_project AND w.average>0)` : 'NULL::integer'} AS official_average
    FROM platform_event_registrations r JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    LEFT JOIN app_users u ON u.id=r.user_id
    WHERE r.event_id=$1::uuid AND r.status='confirmed' AND t.competition_project IS NOT NULL
    ORDER BY r.updated_at,r.id`, [eventId]);
  const history = registrations.length ? await platformQuery<{ user_id: string; project: string; device: string; attempts: unknown }>(db, `
    SELECT r.user_id::text,t.competition_project AS project,t.competition_device AS device,r.competition_attempts AS attempts
    FROM platform_event_registrations r JOIN platform_competitions c ON c.event_id=r.event_id AND c.finalized_at IS NOT NULL
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    WHERE r.user_id=ANY($1::bigint[]) AND r.status='attended' AND r.competition_attempts IS NOT NULL`,
  [[...new Set(registrations.map(r => r.user_id))]]) : [];
  const local = new Map<string, number>();
  for (const row of history) {
    const average = competitionResultSummary(row.attempts).averageCentiseconds;
    if (average !== null) {
      const key = `${row.user_id}:${row.project}:${row.device}`;
      local.set(key, Math.min(average, local.get(key) ?? Infinity));
    }
  }
  const groups = new Map<string, typeof registrations>();
  for (const entry of registrations) {
    if (!groups.has(entry.ticket_type_id)) groups.set(entry.ticket_type_id, []);
    groups.get(entry.ticket_type_id)!.push(entry);
  }
  const matches: Array<MatchDraft & { ticket: string }> = [];
  for (const [ticket, entrants] of groups) {
    if (entrants.length < 2) continue;
    const average = (r: typeof entrants[number]) => r.official_average ?? local.get(`${r.user_id}:${r.project}:${r.device}`) ?? Infinity;
    entrants.sort((a, b) => average(a) - average(b));
    for (const match of bracketFor(entrants.map(r => r.id))) matches.push({ ...match, ticket });
  }
  for (let offset = 0; offset < matches.length; offset += 1000) await platformQuery(db, `INSERT INTO platform_competition_matches
    (id,event_id,ticket_type_id,bracket_side,round_number,match_number,best_of,
      player_a_registration_id,player_b_registration_id,slot_a_resolved,slot_b_resolved,
      next_win_match_id,next_win_slot,next_loss_match_id,next_loss_slot)
    SELECT m.id,$1::uuid,m.ticket,m.side,m.round,m.number,m."bestOf",m.a,m.b,m.seeded,m.seeded,
      (m.win->>'matchId')::uuid,(m.win->>'slot')::smallint,(m.loss->>'matchId')::uuid,(m.loss->>'slot')::smallint
    FROM jsonb_to_recordset($2::jsonb) AS m(id uuid,ticket uuid,side text,round smallint,number integer,
      "bestOf" smallint,a uuid,b uuid,seeded boolean,win jsonb,loss jsonb)`, [eventId, matches.slice(offset, offset + 1000)]);
  await resolveCompetitionBracketSlots(db, eventId);
  // A division with fewer than two paid entries is settled as a one-player walkover.
  // Closed intake is recorded even for an empty event, so the scheduler can move on.
  await platformQuery(db, 'UPDATE platform_competitions SET brackets_generated_at=NOW() WHERE event_id=$1::uuid', [eventId]);
  return !!matches.length;
}

export function effectiveMatchTime(result: MatchResult) {
  return result.centiseconds == null ? Infinity : result.centiseconds + (result.penalty === '+2' ? 200 : 0);
}

export async function decideCompetitionGame(db: PlatformDb, match: Match, gameNumber: number, a: MatchResult, b: MatchResult) {
  const timeA = effectiveMatchTime(a);
  const timeB = effectiveMatchTime(b);
  const winner = timeA < timeB ? match.player_a_registration_id : timeB < timeA ? match.player_b_registration_id : null;
  const scoreA = match.score_a + Number(winner !== null && winner === match.player_a_registration_id);
  const scoreB = match.score_b + Number(winner !== null && winner === match.player_b_registration_id);
  const done = Math.max(scoreA, scoreB) > match.best_of / 2;
  await platformQuery(db, `UPDATE platform_competition_match_games SET winner_registration_id=$3::uuid,resolved_at=NOW()
    WHERE match_id=$1::uuid AND game_number=$2`, [match.id, gameNumber, winner]);
  await platformQuery(db, `UPDATE platform_competition_matches SET score_a=$2,score_b=$3,
    status=$4,winner_registration_id=$5::uuid WHERE id=$1::uuid`, [match.id, scoreA, scoreB, done ? 'completed' : 'ready', done ? winner : null]);
  if (done) {
    const loser = winner === match.player_a_registration_id ? match.player_b_registration_id : match.player_a_registration_id;
    await advanceCompetitionMatch(db, match, winner, loser);
    await resolveCompetitionBracketSlots(db, match.event_id);
  }
}

async function tiedMatchWinner(db: PlatformDb, match: Match) {
  const games = await platformQuery<{ result_a: MatchResult | null; result_b: MatchResult | null }>(db,
    `SELECT result_a,result_b FROM platform_competition_match_games WHERE match_id=$1::uuid AND resolved_at IS NOT NULL`, [match.id]);
  let bestA = Infinity;
  let bestB = Infinity;
  for (const game of games) {
    if (game.result_a) bestA = Math.min(bestA, effectiveMatchTime(game.result_a));
    if (game.result_b) bestB = Math.min(bestB, effectiveMatchTime(game.result_b));
  }
  if (!Number.isFinite(bestA) && !Number.isFinite(bestB)) return null;
  if (bestA !== bestB) return bestA < bestB ? match.player_a_registration_id : match.player_b_registration_id;

  // The immutable opening slots preserve the original seeds, including byes.
  const opening = await platformQuery<Pick<Match, 'player_a_registration_id' | 'player_b_registration_id'>>(db,
    `SELECT player_a_registration_id,player_b_registration_id FROM platform_competition_matches
    WHERE ticket_type_id=$1::uuid AND bracket_side='winners' AND round_number=1 ORDER BY match_number`, [match.ticket_type_id]);
  const entrants = opening.flatMap(row => [row.player_a_registration_id, row.player_b_registration_id]);
  const seeds = foldedSeedOrder(entrants.length);
  const seedA = seeds[entrants.indexOf(match.player_a_registration_id)] ?? Infinity;
  const seedB = seeds[entrants.indexOf(match.player_b_registration_id)] ?? Infinity;
  return seedA <= seedB ? match.player_a_registration_id : match.player_b_registration_id;
}

export async function closeEndedCompetitionBrackets(db: PlatformDb, eventId: string) {
  let closed = 0;
  for (;;) {
    const matches = await platformQuery<Match>(db, `SELECT * FROM platform_competition_matches
      WHERE event_id=$1::uuid AND status IN ('ready','in_progress') ORDER BY bracket_side,round_number,match_number`, [eventId]);
    if (!matches.length) return closed;
    for (const match of matches) {
      const [game] = await platformQuery<{ game_number: number; result_a: MatchResult | null; result_b: MatchResult | null }>(db,
        `SELECT game_number,result_a,result_b FROM platform_competition_match_games WHERE match_id=$1::uuid AND resolved_at IS NULL`, [match.id]);
      if (game) {
        const dns: MatchResult = { centiseconds: null, penalty: 'DNS' };
        await platformQuery(db, `UPDATE platform_competition_match_games SET result_a=COALESCE(result_a,$3::jsonb),result_b=COALESCE(result_b,$3::jsonb)
          WHERE match_id=$1::uuid AND game_number=$2`, [match.id, game.game_number, dns]);
        await decideCompetitionGame(db, match, game.game_number, game.result_a ?? dns, game.result_b ?? dns);
      }
      const [current] = await platformQuery<Match>(db, 'SELECT * FROM platform_competition_matches WHERE id=$1::uuid', [match.id]);
      if (current.status !== 'completed') {
        const winner = current.score_a > current.score_b ? current.player_a_registration_id : current.score_b > current.score_a ? current.player_b_registration_id : await tiedMatchWinner(db, current);
        const loser = !winner ? null : winner === current.player_a_registration_id ? current.player_b_registration_id : current.player_a_registration_id;
        await platformQuery(db, `UPDATE platform_competition_matches SET status='completed',winner_registration_id=$2::uuid WHERE id=$1::uuid`, [current.id, winner]);
        await advanceCompetitionMatch(db, current, winner, loser);
      }
      closed++;
    }
    await resolveCompetitionBracketSlots(db, eventId);
  }
}
