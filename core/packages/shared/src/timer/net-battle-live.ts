import {
  isNetBattleCredentials,
  isNetBattlePlayerId,
  isNetBattleRoomCode,
  type NetBattleCredentials,
} from './net-battle';
import type { Quat } from '../smart_cube/orientation';

export const NET_BATTLE_LIVE_PATH = '/v1/smart-cube/relay?mode=battle';
export const NET_BATTLE_LIVE_PROTOCOL_VERSION = 1 as const;
export const NET_BATTLE_LIVE_MAX_MESSAGE_BYTES = 2 * 1024;

export interface NetBattleLiveHello extends NetBattleCredentials {
  type: 'hello';
  version: typeof NET_BATTLE_LIVE_PROTOCOL_VERSION;
  code: string;
  /** Optional capability: old clients and servers keep the v1 move stream. */
  gyro?: true;
}

export type NetBattleLiveClientPayload =
  | { type: 'gyro'; round: number; quaternion: Quat | null }
  | { type: 'snapshot'; round: number; seq: number; facelets: string }
  | { type: 'move'; round: number; seq: number; move: string }
  | { type: 'unavailable'; round: number };

export interface NetBattleLivePresencePlayer {
  playerId: string;
  connected: boolean;
  smart: boolean;
  round: number | null;
}

export type NetBattleLiveServerPayload =
  | { type: 'ready'; version: typeof NET_BATTLE_LIVE_PROTOCOL_VERSION; gyro?: true }
  | { type: 'gyro'; playerId: string; round: number; quaternion: Quat | null }
  | {
      type: 'snapshot';
      playerId: string;
      round: number;
      seq: number;
      facelets: string;
      updatedAt: number;
    }
  | {
      type: 'move';
      playerId: string;
      round: number;
      seq: number;
      move: string;
      updatedAt: number;
    }
  | { type: 'presence'; players: NetBattleLivePresencePlayer[] }
  | { type: 'resync'; round: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRound(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isSeq(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFacelets(value: unknown): value is string {
  return typeof value === 'string' && /^[URFDLB]{54}$/.test(value);
}

function isMove(value: unknown): value is string {
  return typeof value === 'string' && /^[URFDLB](?:2|')?$/.test(value);
}

/** Display-space unit quaternion; null explicitly disables orientation sharing. */
function isQuaternion(value: unknown): value is Quat | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  const components = [value.w, value.x, value.y, value.z];
  return components.every(v => typeof v === 'number' && Number.isFinite(v))
    && Math.abs(Math.hypot(...components as number[]) - 1) < 0.01;
}

function copyQuaternion(q: Quat | null): Quat | null {
  return q ? { w: q.w, x: q.x, y: q.y, z: q.z } : null;
}

export function parseNetBattleLiveHello(value: unknown): NetBattleLiveHello | null {
  if (!isRecord(value)
    || value.type !== 'hello'
    || value.version !== NET_BATTLE_LIVE_PROTOCOL_VERSION
    || !isNetBattleRoomCode(value.code)
    || !isNetBattleCredentials(value)) return null;
  return {
    type: 'hello',
    version: NET_BATTLE_LIVE_PROTOCOL_VERSION,
    code: value.code,
    playerId: value.playerId,
    playerToken: value.playerToken,
    ...(value.gyro === true ? { gyro: true as const } : {}),
  };
}

export function parseNetBattleLiveClientPayload(value: unknown): NetBattleLiveClientPayload | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'gyro') {
    return isRound(value.round) && isQuaternion(value.quaternion)
      ? { type: 'gyro', round: value.round, quaternion: copyQuaternion(value.quaternion) }
      : null;
  }
  if (value.type === 'snapshot') {
    return isRound(value.round) && isSeq(value.seq) && isFacelets(value.facelets)
      ? { type: 'snapshot', round: value.round, seq: value.seq, facelets: value.facelets }
      : null;
  }
  if (value.type === 'move') {
    return isRound(value.round) && isSeq(value.seq) && value.seq > 0 && isMove(value.move)
      ? { type: 'move', round: value.round, seq: value.seq, move: value.move }
      : null;
  }
  if (value.type === 'unavailable') {
    return isRound(value.round) ? { type: 'unavailable', round: value.round } : null;
  }
  return null;
}

function parsePresencePlayer(value: unknown): NetBattleLivePresencePlayer | null {
  if (!isRecord(value)
    || !isNetBattlePlayerId(value.playerId)
    || typeof value.connected !== 'boolean'
    || typeof value.smart !== 'boolean'
    || !(value.round === null || isRound(value.round))) return null;
  return {
    playerId: value.playerId,
    connected: value.connected,
    smart: value.smart,
    round: value.round,
  };
}

export function parseNetBattleLiveServerPayload(value: unknown): NetBattleLiveServerPayload | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'ready') {
    return value.version === NET_BATTLE_LIVE_PROTOCOL_VERSION
      ? { type: 'ready', version: NET_BATTLE_LIVE_PROTOCOL_VERSION,
          ...(value.gyro === true ? { gyro: true as const } : {}) }
      : null;
  }
  if (value.type === 'gyro') {
    return isNetBattlePlayerId(value.playerId) && isRound(value.round) && isQuaternion(value.quaternion)
      ? { type: 'gyro', playerId: value.playerId, round: value.round, quaternion: copyQuaternion(value.quaternion) }
      : null;
  }
  if (value.type === 'snapshot') {
    return isNetBattlePlayerId(value.playerId)
      && isRound(value.round)
      && isSeq(value.seq)
      && isFacelets(value.facelets)
      && isTimestamp(value.updatedAt)
      ? {
          type: 'snapshot',
          playerId: value.playerId,
          round: value.round,
          seq: value.seq,
          facelets: value.facelets,
          updatedAt: value.updatedAt,
        }
      : null;
  }
  if (value.type === 'move') {
    return isNetBattlePlayerId(value.playerId)
      && isRound(value.round)
      && isSeq(value.seq)
      && value.seq > 0
      && isMove(value.move)
      && isTimestamp(value.updatedAt)
      ? {
          type: 'move',
          playerId: value.playerId,
          round: value.round,
          seq: value.seq,
          move: value.move,
          updatedAt: value.updatedAt,
        }
      : null;
  }
  if (value.type === 'presence') {
    if (!Array.isArray(value.players) || value.players.length > 8) return null;
    const players = value.players.map(parsePresencePlayer);
    return players.every((player): player is NetBattleLivePresencePlayer => player !== null)
      ? { type: 'presence', players }
      : null;
  }
  if (value.type === 'resync') {
    return isRound(value.round) ? { type: 'resync', round: value.round } : null;
  }
  return null;
}
