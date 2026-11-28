import { competitionCheckInWindow } from './competition_checkin.js';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isCompetitionLiveRoom, type NetBattleCredentials } from '@cuberoot/shared/timer';
import { BattleRoomLiveRelay } from '../battle_live_relay.js';
import { sql } from '../db/connection.js';
import { platformDb, platformQuery } from './db.js';

const secret = process.env.PLATFORM_MEDIA_SIGNING_SECRET || randomBytes(32);
const ttlSeconds = 15 * 60;
export const competitionLiveRelay = new BattleRoomLiveRelay({ validRoom: isCompetitionLiveRoom, maxPeers: 256 });

function sign(roomId: string, playerId: string, expires: number) {
  return createHmac('sha256', secret).update(`competition:${roomId}:${playerId}:${expires}`).digest('base64url');
}

export function competitionLivePlayer(userId: string | number | null) {
  return userId == null ? null : BigInt(userId).toString(36).padStart(6, '0');
}

export function competitionLiveCredentials(roomId: string, userId: number | null): NetBattleCredentials | null {
  const playerId = competitionLivePlayer(userId);
  if (!playerId) return null;
  // Keep credentials stable across HTTP snapshots so the client can retain its socket.
  const expires = Math.floor(Date.now() / 60_000) * 60 + ttlSeconds;
  return { playerId, playerToken: `${expires}_${sign(roomId, playerId, expires)}` };
}

export async function authorizeCompetitionLive(roomId: string, credentials: NetBattleCredentials) {
  const { playerId, playerToken } = credentials;
  const match = /^(\d{10})_([A-Za-z0-9_-]{43})$/.exec(playerToken);
  if (!match || Number(match[1]) < Date.now() / 1000) return false;
  if (!timingSafeEqual(Buffer.from(match[2]), Buffer.from(sign(roomId, playerId, Number(match[1]))))) return false;
  const seats = await platformQuery<{ user_id: string }>(platformDb(), `SELECT r.user_id::text
    FROM platform_event_registrations r JOIN platform_events e ON e.id=r.event_id
    WHERE e.status IN ('published','completed') AND r.status IN ('confirmed','attended') AND (
      EXISTS(SELECT 1 FROM platform_competition_matches m JOIN platform_competition_sessions s ON s.id=r.competition_session_id
        WHERE m.id=$1::uuid AND m.status IN ('ready','in_progress') AND e.status='published'
        AND ${competitionCheckInWindow('s')} AND ${competitionCheckInWindow('e')}
        AND (r.checked_in_at IS NOT NULL OR s.session_kind='offline') AND r.id IN (m.player_a_registration_id,m.player_b_registration_id))
      OR (r.checked_in_at IS NOT NULL AND EXISTS(SELECT 1 FROM platform_competition_attempts a
        WHERE a.registration_id=r.id AND a.arena_round_id=$1::uuid)))`, [roomId]);
  return seats.some(seat => competitionLivePlayer(seat.user_id) === playerId);
}

export function startCompetitionLiveNotifications() {
  void sql.listen('competition_arena', roomId => {
    if (isCompetitionLiveRoom(roomId)) competitionLiveRelay.invalidate(roomId);
  }).catch(error => console.warn('Competition live notifications unavailable', error));
  setInterval(() => competitionLiveRelay.pruneExpired(), 60_000).unref();
}
