import { WCA_EVENT_ORDER } from './wca_events';

export const CALC_LIVE_MAX_MESSAGE_BYTES = 16 * 1024;
export const CALC_LIVE_MAX_RESULT = 2_000_000_000;
export const CALC_LIVE_ROOM_CODE_LENGTH = 8;

const WCA_EVENTS = new Set<string>(WCA_EVENT_ORDER);
const MO3_EVENTS = new Set(['666', '777', '444bf', '555bf', '333fm', '333mbf', '333mbo']);
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const HOST_TOKEN_RE = /^[a-f0-9]{32,64}$/;

export interface CalcLiveSnapshot {
  version: 1;
  event: string;
  times: number[][];
  names: string[];
  seedOn: number;
  playerEnabled: [boolean, boolean];
  targetAvgs: Record<number, number>;
}

export type CalcLiveHello =
  | { type: 'hello'; role: 'host'; code: string; token: string }
  | { type: 'hello'; role: 'viewer'; code: string };

export interface CalcLiveStateMessage {
  type: 'state';
  state: CalcLiveSnapshot;
}

export type CalcLiveServerMessage =
  | { type: 'ready'; role: 'host' | 'viewer' }
  | { type: 'snapshot'; revision: number; updatedAt: number; state: CalcLiveSnapshot }
  | { type: 'status'; live: boolean; viewers: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedInteger(value: unknown, max = CALC_LIVE_MAX_RESULT): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
}

export function isCalcLiveRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE_RE.test(value);
}

export function isCalcLiveHostToken(value: unknown): value is string {
  return typeof value === 'string' && HOST_TOKEN_RE.test(value);
}

export function parseCalcLiveHello(value: unknown): CalcLiveHello | null {
  if (!isRecord(value) || value.type !== 'hello' || !isCalcLiveRoomCode(value.code)) return null;
  if (value.role === 'viewer') return { type: 'hello', role: 'viewer', code: value.code };
  if (value.role === 'host' && isCalcLiveHostToken(value.token)) {
    return { type: 'hello', role: 'host', code: value.code, token: value.token };
  }
  return null;
}

/** Validate untrusted browser/relay data and return a detached canonical snapshot. */
export function parseCalcLiveSnapshot(value: unknown): CalcLiveSnapshot | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.event !== 'string'
    || !WCA_EVENTS.has(value.event)) return null;

  const solveCount = MO3_EVENTS.has(value.event) ? 3 : 5;
  if (!Array.isArray(value.times) || value.times.length < 2 || value.times.length > 20
    || value.times.length % 2 !== 0) return null;
  const times: number[][] = [];
  for (const row of value.times) {
    if (!Array.isArray(row) || row.length !== solveCount
      || !row.every((result) => isBoundedInteger(result))) return null;
    times.push([...row]);
  }

  if (!Array.isArray(value.names) || value.names.length !== times.length
    || !value.names.every((name) => typeof name === 'string'
      && name.length <= 64 && !/[\u0000-\u001f\u007f]/.test(name))) return null;
  const names = [...value.names] as string[];

  if (!Number.isInteger(value.seedOn) || (value.seedOn as number) < 0
    || (value.seedOn as number) % 2 !== 0 || (value.seedOn as number) + 1 >= times.length) return null;

  if (!Array.isArray(value.playerEnabled) || value.playerEnabled.length !== 2
    || !value.playerEnabled.every((enabled) => typeof enabled === 'boolean')
    || !value.playerEnabled.some(Boolean)) return null;
  const playerEnabled: [boolean, boolean] = [value.playerEnabled[0], value.playerEnabled[1]];

  if (!isRecord(value.targetAvgs)) return null;
  const targetAvgs: Record<number, number> = {};
  for (const [rawIndex, target] of Object.entries(value.targetAvgs)) {
    if (!/^\d+$/.test(rawIndex)) return null;
    const index = Number(rawIndex);
    if (index >= times.length || !isBoundedInteger(target, 1_000_000_000)) return null;
    if (target > 0) targetAvgs[index] = target;
  }

  return {
    version: 1,
    event: value.event,
    times,
    names,
    seedOn: value.seedOn as number,
    playerEnabled,
    targetAvgs,
  };
}

export function parseCalcLiveStateMessage(value: unknown): CalcLiveStateMessage | null {
  if (!isRecord(value) || value.type !== 'state') return null;
  const state = parseCalcLiveSnapshot(value.state);
  return state ? { type: 'state', state } : null;
}

export function parseCalcLiveServerMessage(value: unknown): CalcLiveServerMessage | null {
  if (!isRecord(value)) return null;
  if (value.type === 'ready' && (value.role === 'host' || value.role === 'viewer')) {
    return { type: 'ready', role: value.role };
  }
  if (value.type === 'status' && typeof value.live === 'boolean'
    && Number.isInteger(value.viewers) && (value.viewers as number) >= 0
    && (value.viewers as number) <= 64) {
    return { type: 'status', live: value.live, viewers: value.viewers as number };
  }
  if (value.type === 'snapshot' && Number.isInteger(value.revision) && (value.revision as number) >= 1
    && Number.isInteger(value.updatedAt) && (value.updatedAt as number) > 0) {
    const state = parseCalcLiveSnapshot(value.state);
    if (state) {
      return {
        type: 'snapshot',
        revision: value.revision as number,
        updatedAt: value.updatedAt as number,
        state,
      };
    }
  }
  return null;
}
