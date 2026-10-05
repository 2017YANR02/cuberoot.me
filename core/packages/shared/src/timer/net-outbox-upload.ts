import { myScramble, playerEventOf, netEventToSelectorId, type NetBattleClient, type NetBattleSessionStore, type NetResult } from './net-battle';
import { netRoomGoneReason } from './net-room-controller';
import type { NetRecordedAttempt } from './net-attempt';

/** Use only the protected, currently saved membership. Journal data never supplies credentials. */
export async function uploadNetRecordedAttempt(record: NetRecordedAttempt,
  client: NetBattleClient, sessions: Pick<NetBattleSessionStore, 'load'>,
): Promise<'uploaded' | 'waiting' | 'rejected'> {
  const { context, solve } = record;
  const session = await sessions.load();
  if (!session) return 'waiting';
  if (session.code !== context.code || session.playerId !== context.playerId) return 'rejected';
  if (!Number.isFinite(solve.timeMs) || solve.timeMs < 0 || solve.timeMs >= 24 * 3600_000) return 'rejected';
  // The room API stores integer milliseconds; preserve raw local timing separately.
  const expected: NetResult = { t: Math.round(solve.timeMs), p: solve.penalty === 'DNF' ? 'dnf' : solve.penalty === '+2' ? '+2' : 'ok' };
  try {
    const state = await client.getNetRoom(context.code, session);
    if (!state.players[context.playerId]) return 'rejected';
    const saved = state.results[String(context.round)]?.[context.playerId]
      ?? state.history.find(round => round.round === context.round)?.results[context.playerId];
    if (saved?.t === expected.t && saved.p === expected.p) return 'uploaded';
    if (state.round !== context.round || netEventToSelectorId(playerEventOf(state, context.playerId)) !== context.event
      || myScramble(state, context.playerId) !== context.scramble) return 'rejected';
    // Leaving/rejoining while the read was pending revokes this send's authority.
    const latest = await sessions.load();
    if (latest?.code !== session.code || latest.playerId !== session.playerId || latest.playerToken !== session.playerToken) return 'waiting';
    const response = await client.postNetResult(context.code, session, context.round, expected.t, expected.p);
    const accepted = response.results[String(context.round)]?.[context.playerId]
      ?? response.history.find(round => round.round === context.round)?.results[context.playerId];
    return accepted?.t === expected.t && accepted.p === expected.p ? 'uploaded' : 'rejected';
  } catch (error) {
    if (netRoomGoneReason(error)) return 'rejected';
    if (error instanceof Error && ['result rejected', 'invalid body', 'wait for next round', 'wait for synchronized start'].includes(error.message)) return 'rejected';
    throw error;
  }
}
