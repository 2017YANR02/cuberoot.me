/**
 * Runtime-neutral contract for `/timer` online battle rooms.
 *
 * Room DTOs, scoring and state derivations are shared by Web and Capacitor.
 * Hosts inject only URL resolution and fetch transport; this package never
 * imports an app-owned API helper or platform runtime.
 */

import {
  timerEventIdFromSelector,
  timerEventSelectorId,
} from './event-catalog';
import type { EventId } from './types';

export const NET_BATTLE_TOKEN_HEADER = 'X-Battle-Token';
export const NET_BATTLE_ROOM_CODE_LENGTH = 4;

export function normalizeNetBattleRoomCode(value: string): string {
  return [...value].filter((character) => character >= '0' && character <= '9')
    .join('').slice(0, NET_BATTLE_ROOM_CODE_LENGTH);
}

export function isNetBattleRoomCode(value: unknown): value is string {
  return typeof value === 'string'
    && value.length === NET_BATTLE_ROOM_CODE_LENGTH
    && [...value].every((character) => character >= '0' && character <= '9');
}

export const NET_EVENTS = [
  '333', '222', '444', '555', '666', '777', '333oh', '333bld',
  'mega', 'pyra', 'clock', 'skewb', 'sq1',
] as const satisfies readonly EventId[];

export type NetBattleEventId = (typeof NET_EVENTS)[number];

const NET_EVENT_SET = new Set<EventId>(NET_EVENTS);

export function isNetBattleEventId(value: unknown): value is NetBattleEventId {
  return typeof value === 'string' && NET_EVENT_SET.has(value as EventId);
}

export type NetPhase = 'idle' | 'ready' | 'inspecting' | 'solving' | 'done';
export type NetPenalty = 'ok' | '+2' | 'dnf';

export interface NetPlayerEntry {
  name: string;
  wcaId?: string;
  iso2?: string;
  joined: number;
  seen: number;
  ph: NetPhase;
  at: number;
  event?: NetBattleEventId;
}

export interface NetIdentity {
  name: string;
  wcaId?: string;
  iso2?: string;
}

/** A public player id plus the private capability that authorizes that player. */
export interface NetBattleCredentials {
  playerId: string;
  playerToken: string;
}

export function isNetBattlePlayerId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]{6,16}$/.test(value);
}

/** Keep private credentials structurally separate from the public room snapshot. */
export interface NetBattleAdmission {
  state: NetRoomState;
  credentials: NetBattleCredentials;
}

export function isNetBattleCredentials(value: unknown): value is NetBattleCredentials {
  return isRecord(value)
    && isNetBattlePlayerId(value.playerId)
    && typeof value.playerToken === 'string'
    && /^[A-Za-z0-9_-]{40,128}$/.test(value.playerToken);
}

/** Canonical persisted session shared by Web sessionStorage and native secure storage. */
export interface NetBattleSession extends NetBattleCredentials {
  code: string;
  name: string;
}

export function decodeNetBattleSession(value: unknown): NetBattleSession | null {
  if (!isRecord(value)
    || !isNetBattleCredentials(value)
    || !isNetBattleRoomCode(value.code)
    || typeof value.name !== 'string') return null;
  return {
    code: value.code,
    name: value.name,
    playerId: value.playerId,
    playerToken: value.playerToken,
  };
}

export interface NetResult {
  t: number;
  p: NetPenalty;
}

export interface NetRoundHistory {
  round: number;
  scrambles: Record<string, string>;
  playerEvents: Record<string, NetBattleEventId>;
  results: Record<string, NetResult>;
  winners: string[];
}

export interface NetRoomState {
  code: string;
  /** Monotonic server version; clients reject delayed responses with a lower revision. */
  revision: number;
  event: NetBattleEventId;
  round: number;
  scrambles: Record<string, string>;
  players: Record<string, NetPlayerEntry>;
  results: Record<string, Record<string, NetResult>>;
  history: NetRoundHistory[];
  scores: Record<string, number>;
  admin: string;
  syncStart: boolean;
  startAt: number | null;
  now: number;
}

export interface NetBattleClientOptions {
  apiUrl(path: string): string;
  fetcher?: typeof fetch;
}

export interface NetBattleClient {
  createNetRoom(event: NetBattleEventId, scramble: string, identity: NetIdentity): Promise<NetBattleAdmission>;
  joinNetRoom(code: string, identity: NetIdentity): Promise<NetBattleAdmission>;
  getNetRoom(code: string, credentials?: NetBattleCredentials): Promise<NetRoomState>;
  postNetStatus(code: string, credentials: NetBattleCredentials, phase: Exclude<NetPhase, 'done'>): Promise<NetRoomState>;
  postNetSyncStart(code: string, credentials: NetBattleCredentials, syncStart: boolean): Promise<NetRoomState>;
  postNetAdmin(code: string, credentials: NetBattleCredentials, target: string): Promise<NetRoomState>;
  postNetKick(code: string, credentials: NetBattleCredentials, target: string): Promise<NetRoomState>;
  renameNetPlayer(code: string, credentials: NetBattleCredentials, identity: NetIdentity): Promise<NetRoomState>;
  postNetEvent(code: string, credentials: NetBattleCredentials, event: NetBattleEventId, scramble: string): Promise<NetRoomState>;
  ensureNetScramble(code: string, credentials: NetBattleCredentials, event: NetBattleEventId, scramble: string): Promise<NetRoomState>;
  postNetResult(code: string, credentials: NetBattleCredentials, round: number, timeMs: number, penalty: NetPenalty): Promise<NetRoomState & { advanced?: boolean }>;
  nextNetRound(code: string, credentials: NetBattleCredentials, round: number, scramble: string): Promise<NetRoomState>;
  leaveNetRoom(code: string, credentials: NetBattleCredentials): Promise<void>;
}

async function responseError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => ({}));
  return new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`);
}

/** Build one room client over a host-provided URL resolver and fetch transport. */
export function createNetBattleClient(options: NetBattleClientOptions): NetBattleClient {
  const request = options.fetcher ?? fetch;

  function roomPath(code: string, suffix = ''): string {
    if (!isNetBattleRoomCode(code)) throw new Error('invalid battle room code');
    return `/v1/battle/rooms/${code}${suffix}`;
  }

  async function readState(response: Response): Promise<NetRoomState> {
    return decodeNetRoomState(await response.json());
  }

  async function postPayload(path: string, body: unknown, credentials?: NetBattleCredentials): Promise<unknown> {
    const response = await request(options.apiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(credentials ? { [NET_BATTLE_TOKEN_HEADER]: credentials.playerToken } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await responseError(response);
    return response.json();
  }

  async function postState(path: string, body: unknown, credentials?: NetBattleCredentials): Promise<NetRoomState> {
    return decodeNetRoomState(await postPayload(path, body, credentials));
  }

  async function postJoin(path: string, body: unknown): Promise<NetBattleAdmission> {
    const value = await postPayload(path, body);
    if (!isNetBattleCredentials(value)) {
      throw new Error('invalid battle room response');
    }
    return {
      state: decodeNetRoomState(value),
      credentials: { playerId: value.playerId, playerToken: value.playerToken },
    };
  }

  return {
    createNetRoom(event, scramble, identity) {
      return postJoin('/v1/battle/rooms', { event, scramble, name: identity.name, wcaId: identity.wcaId, iso2: identity.iso2 });
    },
    joinNetRoom(code, identity) {
      return postJoin(roomPath(code, '/join'), { name: identity.name, wcaId: identity.wcaId, iso2: identity.iso2 });
    },
    async getNetRoom(code, credentials) {
      const path = roomPath(code, credentials ? `?pid=${credentials.playerId}` : '');
      const response = await request(options.apiUrl(path), credentials ? {
        headers: { [NET_BATTLE_TOKEN_HEADER]: credentials.playerToken },
      } : undefined);
      if (!response.ok) throw await responseError(response);
      return readState(response);
    },
    postNetStatus(code, credentials, phase) {
      return postState(roomPath(code, '/status'), { pid: credentials.playerId, ph: phase }, credentials);
    },
    postNetSyncStart(code, credentials, syncStart) {
      return postState(roomPath(code, '/settings'), { pid: credentials.playerId, syncStart }, credentials);
    },
    postNetAdmin(code, credentials, target) {
      return postState(roomPath(code, '/admin'), { pid: credentials.playerId, target }, credentials);
    },
    postNetKick(code, credentials, target) {
      return postState(roomPath(code, '/kick'), { pid: credentials.playerId, target }, credentials);
    },
    renameNetPlayer(code, credentials, identity) {
      return postState(roomPath(code, '/name'), { pid: credentials.playerId, name: identity.name, wcaId: identity.wcaId, iso2: identity.iso2 }, credentials);
    },
    postNetEvent(code, credentials, event, scramble) {
      return postState(roomPath(code, '/event'), { pid: credentials.playerId, event, scramble }, credentials);
    },
    ensureNetScramble(code, credentials, event, scramble) {
      return postState(roomPath(code, '/scramble'), { pid: credentials.playerId, event, scramble }, credentials);
    },
    async postNetResult(code, credentials, round, timeMs, penalty) {
      const value = await postPayload(
        roomPath(code, '/result'),
        { pid: credentials.playerId, round, t: timeMs, p: penalty },
        credentials,
      );
      return {
        ...decodeNetRoomState(value),
        ...(isRecord(value) && typeof value.advanced === 'boolean' ? { advanced: value.advanced } : {}),
      };
    },
    nextNetRound(code, credentials, round, scramble) {
      return postState(roomPath(code, '/next'), { pid: credentials.playerId, round, scramble }, credentials);
    },
    async leaveNetRoom(code, credentials) {
      const response = await request(options.apiUrl(roomPath(code, '/leave')), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [NET_BATTLE_TOKEN_HEADER]: credentials.playerToken,
        },
        body: JSON.stringify({ pid: credentials.playerId }),
      });
      if (!response.ok) throw await responseError(response);
    },
  };
}

export const OFFLINE_MS = 15_000;

/** Return bilingual copy data; hosts render it through the canonical i18n helper. */
export function netErrorMessage(error: unknown): { zh: string; en: string } {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message === 'room not found') return { zh: '房间不存在或已过期', en: 'Room not found or expired' };
  if (message === 'room full') return { zh: '房间人数已满', en: 'Room is full' };
  if (message === 'round in progress') return { zh: '本轮正在进行，请等下一轮再加入', en: 'This round is in progress — join on the next round' };
  if (message === 'name taken') return { zh: '这个名字房里已经有人用了,换一个', en: 'That name is already taken in this room' };
  if (message === 'not admin') return { zh: '你已不是房主了', en: 'You are no longer the host' };
  if (message === 'player not in room') return { zh: 'TA 已经不在房间里了', en: 'That player is no longer in the room' };
  if (message === 'invalid player capability') return { zh: '房间身份已失效，请重新加入', en: 'Your room session expired — rejoin the room' };
  if (/HTTP 404/.test(message)) return { zh: '联机服务暂不可用,请稍后重试', en: 'Online service is unavailable — please try again later' };
  if (/HTTP 5\d\d/.test(message)) return { zh: '服务器开小差了,请稍后重试', en: 'Server error — please try again later' };
  if (/failed to fetch|networkerror|load failed/i.test(message)) return { zh: '网络连接失败,请检查网络', en: 'Network error — check your connection' };
  return { zh: message || '出错了,请重试', en: message || 'Something went wrong — please retry' };
}

export function effectiveNetMs(result: NetResult): number {
  if (result.p === 'dnf') return Infinity;
  return result.p === '+2' ? result.t + 2_000 : result.t;
}

/**
 * Settle one server round by event. A valid fastest result is shown as a
 * winner even in a one-person event group, but a win is scored only when at
 * least two players competed in that same event.
 */
export function settleNetRound(
  results: Record<string, NetResult>,
  playerEvents: Record<string, NetBattleEventId>,
): { winners: string[]; scored: string[] } {
  const byEvent: Partial<Record<NetBattleEventId, Array<[string, NetResult]>>> = {};
  for (const [id, result] of Object.entries(results)) {
    const event = playerEvents[id];
    if (!event) continue;
    (byEvent[event] ??= []).push([id, result]);
  }
  const winners: string[] = [];
  const scored: string[] = [];
  for (const group of Object.values(byEvent)) {
    if (!group) continue;
    const best = Math.min(...group.map(([, result]) => effectiveNetMs(result)));
    if (!Number.isFinite(best)) continue;
    const groupWinners = group
      .filter(([, result]) => effectiveNetMs(result) === best)
      .map(([id]) => id);
    winners.push(...groupWinners);
    if (group.length >= 2) scored.push(...groupWinners);
  }
  return { winners, scored };
}

export function roundWinners(results: Record<string, NetResult> | undefined, players: Record<string, NetPlayerEntry>): string[] {
  if (!results) return [];
  const entries = Object.entries(results).filter(([id]) => players[id]);
  if (entries.length === 0) return [];
  const byEvent: Record<string, Array<[string, NetResult]>> = {};
  for (const [id, result] of entries) {
    const event = players[id]?.event ?? '';
    (byEvent[event] ??= []).push([id, result]);
  }
  const winners: string[] = [];
  for (const group of Object.values(byEvent)) {
    const best = Math.min(...group.map(([, result]) => effectiveNetMs(result)));
    if (!Number.isFinite(best)) continue;
    for (const [id, result] of group) if (effectiveNetMs(result) === best) winners.push(id);
  }
  return winners;
}

export function playerEventOf(state: NetRoomState, playerId: string): NetBattleEventId {
  return state.players[playerId]?.event || state.event;
}

export function myScramble(state: NetRoomState, playerId: string): string | null {
  return state.scrambles?.[playerEventOf(state, playerId)] ?? null;
}

export function sortedNetPlayers(players: Record<string, NetPlayerEntry>): Array<{ id: string } & NetPlayerEntry> {
  return Object.entries(players)
    .map(([id, player]) => ({ id, ...player }))
    .sort((a, b) => a.joined - b.joined || a.id.localeCompare(b.id));
}

export function isNetOnline(player: NetPlayerEntry, serverNow: number): boolean {
  return serverNow - player.seen <= OFFLINE_MS;
}

export function blendClockOffset(previous: number | null, serverNow: number, clientNow: number): number {
  const sample = serverNow - clientNow;
  if (previous === null) return sample;
  return previous + (sample - previous) * 0.2;
}

/** Resolve out-of-order polling/mutation responses using the server's monotonic room revision. */
export function preferLatestNetRoomState(previous: NetRoomState | null, incoming: NetRoomState): NetRoomState {
  return previous
    && previous.code === incoming.code
    && (incoming.revision < previous.revision
      || (incoming.revision === previous.revision && incoming.now < previous.now))
    ? previous
    : incoming;
}

export function isRoundComplete(state: NetRoomState): boolean {
  const online = sortedNetPlayers(state.players).filter((player) => isNetOnline(player, state.now));
  if (online.length < 2) return false;
  const results = state.results[String(state.round)] ?? {};
  return online.every((player) => !!results[player.id]);
}

export function pendingCount(state: NetRoomState): number {
  const online = sortedNetPlayers(state.players).filter((player) => isNetOnline(player, state.now));
  const results = state.results[String(state.round)] ?? {};
  return online.filter((player) => !results[player.id]).length;
}

export function isNetAdmin(state: NetRoomState, playerId: string | null): boolean {
  return !!playerId && state.admin === playerId;
}

export interface NetSyncGate { gated: boolean; ready: boolean; waiting: number }

export function syncGate(state: NetRoomState, playerId: string | null): NetSyncGate {
  const results = state.results[String(state.round)] ?? {};
  const contenders = sortedNetPlayers(state.players).filter((player) => isNetOnline(player, state.now) && !results[player.id]);
  const ready = !!playerId && state.players[playerId]?.ph === 'ready';
  const iAmContender = !!playerId && contenders.some((player) => player.id === playerId);
  return {
    gated: !!state.syncStart && iAmContender && contenders.length >= 2 && state.startAt === null,
    ready,
    waiting: contenders.filter((player) => player.ph !== 'ready').length,
  };
}

export function playerTimeline(state: NetRoomState, playerId: string): NetResult[] {
  const results: NetResult[] = [];
  for (const round of state.history ?? []) {
    const result = round.results[playerId];
    if (result) results.push(result);
  }
  const current = state.results[String(state.round)]?.[playerId];
  if (current) results.push(current);
  return results;
}

export interface NetStats { count: number; single: number | null; ao5: number | null; mean: number | null }

export function playerStats(results: NetResult[]): NetStats {
  const count = results.length;
  const effective = results.map(effectiveNetMs);
  const valid = effective.filter(Number.isFinite);
  const single = valid.length ? Math.min(...valid) : null;
  let mean: number | null = null;
  if (count > 0) {
    mean = effective.some((time) => !Number.isFinite(time))
      ? Infinity
      : Math.round(effective.reduce((sum, time) => sum + time, 0) / count);
  }
  let ao5: number | null = null;
  if (count >= 5) {
    const lastFive = effective.slice(-5).sort((a, b) => a - b);
    const dnfCount = lastFive.filter((time) => !Number.isFinite(time)).length;
    ao5 = dnfCount >= 2 ? Infinity : Math.round((lastFive[1] + lastFive[2] + lastFive[3]) / 3);
  }
  return { count, single, ao5, mean };
}

export interface NetRoundView {
  round: number;
  scrambles: Record<string, string>;
  playerEvents: Record<string, NetBattleEventId>;
  results: Record<string, NetResult>;
  winners: string[];
  live: boolean;
}

export function roundViews(state: NetRoomState): NetRoundView[] {
  const currentResults = state.results[String(state.round)] ?? {};
  const currentPlayerEvents: Record<string, NetBattleEventId> = {};
  for (const [id, player] of Object.entries(state.players)) currentPlayerEvents[id] = player.event || state.event;
  const views: NetRoundView[] = [{
    round: state.round,
    scrambles: state.scrambles ?? {},
    playerEvents: currentPlayerEvents,
    results: currentResults,
    winners: roundWinners(currentResults, state.players),
    live: true,
  }];
  for (const round of [...(state.history ?? [])].reverse()) {
    views.push({
      round: round.round,
      scrambles: round.scrambles ?? {},
      playerEvents: round.playerEvents ?? {},
      results: round.results,
      winners: round.winners,
      live: false,
    });
  }
  return views;
}

export function netEventToSelectorId(event: NetBattleEventId): string {
  return timerEventSelectorId(event);
}

export function selectorIdToNetEvent(event: string): NetBattleEventId | null {
  const internal = timerEventIdFromSelector(event);
  return internal && isNetBattleEventId(internal) ? internal : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNetPhase(value: unknown): value is NetPhase {
  return value === 'idle' || value === 'ready' || value === 'inspecting' || value === 'solving' || value === 'done';
}

function isNetPenalty(value: unknown): value is NetPenalty {
  return value === 'ok' || value === '+2' || value === 'dnf';
}

function decodeResults(value: unknown): Record<string, NetResult> {
  if (!isRecord(value)) throw new Error('invalid battle room response');
  const results: Record<string, NetResult> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isNetBattlePlayerId(id)
      || !isRecord(raw)
      || typeof raw.t !== 'number'
      || !Number.isFinite(raw.t)
      || raw.t < 0
      || !isNetPenalty(raw.p)) {
      throw new Error('invalid battle room response');
    }
    results[id] = { t: raw.t, p: raw.p };
  }
  return results;
}

function decodeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) throw new Error('invalid battle room response');
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') throw new Error('invalid battle room response');
    result[key] = item;
  }
  return result;
}

function decodeEventMap(value: unknown): Record<string, NetBattleEventId> {
  if (!isRecord(value)) throw new Error('invalid battle room response');
  const result: Record<string, NetBattleEventId> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isNetBattlePlayerId(key) || !isNetBattleEventId(item)) throw new Error('invalid battle room response');
    result[key] = item;
  }
  return result;
}

/** Reject malformed or non-canonical room payloads at the app boundary. */
export function decodeNetRoomState(value: unknown): NetRoomState {
  if (!isRecord(value)
    || !isNetBattleRoomCode(value.code)
    || !Number.isInteger(value.revision)
    || (value.revision as number) < 1
    || !isNetBattleEventId(value.event)
    || !Number.isInteger(value.round)
    || (value.round as number) < 1
    || !isRecord(value.players)
    || !isRecord(value.results)
    || !Array.isArray(value.history)
    || !isRecord(value.scores)
    || (value.admin !== '' && !isNetBattlePlayerId(value.admin))
    || typeof value.syncStart !== 'boolean'
    || (value.startAt !== null && (typeof value.startAt !== 'number' || !Number.isFinite(value.startAt)))
    || typeof value.now !== 'number'
    || !Number.isFinite(value.now)) {
    throw new Error('invalid battle room response');
  }

  const players: Record<string, NetPlayerEntry> = {};
  for (const [id, raw] of Object.entries(value.players)) {
    if (!isNetBattlePlayerId(id)
      || !isRecord(raw)
      || typeof raw.name !== 'string'
      || typeof raw.joined !== 'number' || !Number.isFinite(raw.joined)
      || typeof raw.seen !== 'number' || !Number.isFinite(raw.seen)
      || !isNetPhase(raw.ph)
      || typeof raw.at !== 'number' || !Number.isFinite(raw.at)
      || (raw.event !== undefined && !isNetBattleEventId(raw.event))
      || (raw.wcaId !== undefined && typeof raw.wcaId !== 'string')
      || (raw.iso2 !== undefined && typeof raw.iso2 !== 'string')) {
      throw new Error('invalid battle room response');
    }
    players[id] = {
      name: raw.name,
      joined: raw.joined,
      seen: raw.seen,
      ph: raw.ph,
      at: raw.at,
      ...(raw.event ? { event: raw.event } : {}),
      ...(raw.wcaId ? { wcaId: raw.wcaId } : {}),
      ...(raw.iso2 ? { iso2: raw.iso2 } : {}),
    };
  }

  const results: Record<string, Record<string, NetResult>> = {};
  for (const [round, raw] of Object.entries(value.results)) {
    if (!/^[1-9]\d*$/.test(round)) throw new Error('invalid battle room response');
    results[round] = decodeResults(raw);
  }

  const history: NetRoundHistory[] = value.history.map((raw) => {
    if (!isRecord(raw)
      || !Number.isInteger(raw.round)
      || (raw.round as number) < 1
      || !Array.isArray(raw.winners)
      || !raw.winners.every(isNetBattlePlayerId)) {
      throw new Error('invalid battle room response');
    }
    return {
      round: raw.round as number,
      scrambles: decodeStringMap(raw.scrambles),
      playerEvents: decodeEventMap(raw.playerEvents),
      results: decodeResults(raw.results),
      winners: raw.winners as string[],
    };
  });

  const scores: Record<string, number> = {};
  for (const [id, score] of Object.entries(value.scores)) {
    if (!isNetBattlePlayerId(id)
      || typeof score !== 'number'
      || !Number.isInteger(score)
      || score < 0) throw new Error('invalid battle room response');
    scores[id] = score;
  }

  return {
    code: value.code,
    revision: value.revision as number,
    event: value.event,
    round: value.round as number,
    scrambles: decodeStringMap(value.scrambles),
    players,
    results,
    history,
    scores,
    admin: value.admin,
    syncStart: value.syncStart,
    startAt: value.startAt as number | null,
    now: value.now,
  };
}
