/**
 * Runtime-neutral contract for `/timer` online battle rooms.
 *
 * Room DTOs, scoring and state derivations are shared by Web and Capacitor.
 * Hosts inject only URL resolution and fetch transport; this package never
 * imports an app-owned API helper or platform runtime.
 */

import {
  timerEventIdFromSelector,
  timerEventPickerName,
  timerEventSelectorId,
} from './event-catalog';
import type { EventId } from './types';
import type { TimerHttpFetch, TimerHttpRequest, TimerHttpResponse } from './http';
import { trimmedMean, formatMs } from './stats';
import { displayCuberName } from '../cuber_name_display';

export const NET_BATTLE_TOKEN_HEADER = 'X-Battle-Token';
export const NET_BATTLE_ROOM_CODE_LENGTH = 4;
export const NET_BATTLE_SESSION_STORAGE_KEY = 'net_battle_session';
export const NET_BATTLE_REQUEST_TIMEOUT_MS = 12_000;

export function normalizeNetBattleRoomCode(value: string): string {
  const invited = /[?&]room=([0-9]{4})(?=$|[&#\s)\]}>.,;!?"'])/.exec(value);
  if (invited) return invited[1];
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

export const NET_RECENT_ROOMS_KEY = 'net_battle_recent_rooms';
export const NET_RECENT_ROOM_TTL_MS = 24 * 60 * 60 * 1_000;

export interface NetRecentRoom {
  code: string;
  event: NetBattleEventId;
  updatedAt: number;
}

export function decodeNetRecentRooms(value: unknown, now: number): NetRecentRoom[] {
  const byCode = new Map<string, NetRecentRoom>();
  if (!Array.isArray(value)) return [];
  for (const item of value) {
    if (!isRecord(item) || !isNetBattleRoomCode(item.code) || !isNetBattleEventId(item.event)
      || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)
      || item.updatedAt > now || now - item.updatedAt >= NET_RECENT_ROOM_TTL_MS) continue;
    const previous = byCode.get(item.code);
    if (!previous || item.updatedAt >= previous.updatedAt) {
      byCode.set(item.code, { code: item.code, event: item.event, updatedAt: item.updatedAt });
    }
  }
  return [...byCode.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
}

export function rememberNetRecentRoom(rooms: readonly NetRecentRoom[], room: Pick<NetRecentRoom, 'code' | 'event'>, now: number) {
  return decodeNetRecentRooms([{ ...room, updatedAt: now }, ...rooms.filter(entry => entry.code !== room.code)], now);
}

export function forgetNetRecentRoom(rooms: readonly NetRecentRoom[], code: string, now: number) {
  return decodeNetRecentRooms(rooms.filter(room => room.code !== code), now);
}

export type NetPhase = 'idle' | 'ready' | 'inspecting' | 'solving' | 'done';
export type NetPenalty = 'ok' | '+2' | 'dnf';

export function isNetPhase(value: unknown): value is NetPhase {
  return value === 'idle' || value === 'ready' || value === 'inspecting' || value === 'solving' || value === 'done';
}

export function isNetWritablePhase(value: unknown): value is Exclude<NetPhase, 'done'> {
  return value === 'idle' || value === 'ready' || value === 'inspecting' || value === 'solving';
}

export function isNetPenalty(value: unknown): value is NetPenalty {
  return value === 'ok' || value === '+2' || value === 'dnf';
}

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

export interface NetBattleSessionStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface NetBattleSessionStore {
  clear(): Promise<void>;
  load(): Promise<NetBattleSession | null>;
  save(session: NetBattleSession): Promise<void>;
}

/** One secure-session codec/store; installed hosts inject only protected I/O. */
export function createNetBattleSessionStore(
  storage: NetBattleSessionStorage,
): NetBattleSessionStore {
  let tail: Promise<unknown> = Promise.resolve();
  const run = <T>(operation: () => Promise<T>): Promise<T> => {
    const pending = tail.then(operation);
    tail = pending.catch(() => undefined);
    return pending;
  };
  return {
    load: () => run(async () => {
      const raw = await storage.getItem(NET_BATTLE_SESSION_STORAGE_KEY);
      if (!raw) return null;
      try {
        return decodeNetBattleSession(JSON.parse(raw));
      } catch {
        return null;
      }
    }),
    save: session => run(async () => {
      const decoded = decodeNetBattleSession(session);
      if (!decoded) throw new Error('invalid battle session');
      await storage.setItem(NET_BATTLE_SESSION_STORAGE_KEY, JSON.stringify(decoded));
    }),
    clear: () => run(async () => {
      await storage.removeItem(NET_BATTLE_SESSION_STORAGE_KEY);
    }),
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
  /** Opaque media-room generation rotated when membership is revoked on self-hosted LiveKit. */
  videoGeneration: string;
  /** Fixed participant set once a synchronized countdown starts; empty before that. */
  roundRoster: string[];
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
  fetcher?: TimerHttpFetch;
}

export interface NetAdmissionGate {
  /** Starts a create/join that must be exclusive. Null means one is already pending. */
  beginExclusive(): number | null;
  /** Starts a restore that may be superseded by a later explicit user choice. */
  beginBackground(): number | null;
  isCurrent(intent: number): boolean;
  /** Releases exclusive busy state only for the still-current owner. */
  finish(intent: number): boolean;
  /** Invalidates every delayed response and releases the synchronous busy latch. */
  cancel(): void;
}

/** Runtime-neutral latest-intent gate shared by Web and the future native multiplayer host. */
export function createNetAdmissionGate(): NetAdmissionGate {
  let current = 0;
  let exclusive: number | null = null;
  return {
    beginExclusive() {
      if (exclusive !== null) return null;
      current += 1;
      exclusive = current;
      return current;
    },
    beginBackground() {
      if (exclusive !== null) return null;
      current += 1;
      return current;
    },
    isCurrent(intent) { return intent === current; },
    finish(intent) {
      if (intent !== current || exclusive !== intent) return false;
      exclusive = null;
      return true;
    },
    cancel() {
      current += 1;
      exclusive = null;
    },
  };
}

export interface NetBattleClient {
  createNetRoom(event: NetBattleEventId, identity: NetIdentity): Promise<NetBattleAdmission>;
  joinNetRoom(code: string, identity: NetIdentity): Promise<NetBattleAdmission>;
  getNetRoom(code: string, credentials?: NetBattleCredentials): Promise<NetRoomState>;
  postNetStatus(code: string, credentials: NetBattleCredentials, phase: Exclude<NetPhase, 'done'>): Promise<NetRoomState>;
  postNetSyncStart(code: string, credentials: NetBattleCredentials, syncStart: boolean): Promise<NetRoomState>;
  postNetAdmin(code: string, credentials: NetBattleCredentials, target: string): Promise<NetRoomState>;
  postNetKick(code: string, credentials: NetBattleCredentials, target: string): Promise<NetRoomState>;
  renameNetPlayer(code: string, credentials: NetBattleCredentials, identity: NetIdentity): Promise<NetRoomState>;
  postNetEvent(code: string, credentials: NetBattleCredentials, event: NetBattleEventId): Promise<NetRoomState>;
  ensureNetScramble(code: string, credentials: NetBattleCredentials, event: NetBattleEventId): Promise<NetRoomState>;
  postNetResult(code: string, credentials: NetBattleCredentials, round: number, timeMs: number, penalty: NetPenalty): Promise<NetRoomState & { advanced?: boolean }>;
  nextNetRound(code: string, credentials: NetBattleCredentials, round: number, force?: boolean): Promise<NetRoomState>;
  leaveNetRoom(code: string, credentials: NetBattleCredentials): Promise<void>;
}

async function responseError(response: TimerHttpResponse): Promise<Error> {
  const payload = await response.json().catch(() => ({}));
  if (response.status >= 500) return new Error(`HTTP ${response.status}`);
  return new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`);
}

/** Build one room client over a host-provided URL resolver and fetch transport. */
export function createNetBattleClient(options: NetBattleClientOptions): NetBattleClient {
  const request = options.fetcher ?? fetch;

  async function requestWithTimeout(input: string, init: TimerHttpRequest = {}): Promise<TimerHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NET_BATTLE_REQUEST_TIMEOUT_MS);
    try {
      return await request(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  function roomPath(code: string, suffix = ''): string {
    if (!isNetBattleRoomCode(code)) throw new Error('invalid battle room code');
    return `/v1/battle/rooms/${code}${suffix}`;
  }

  async function readState(response: TimerHttpResponse): Promise<NetRoomState> {
    return decodeNetRoomState(await response.json());
  }

  async function postPayload(path: string, body: unknown, credentials?: NetBattleCredentials): Promise<unknown> {
    const response = await requestWithTimeout(options.apiUrl(path), {
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
    createNetRoom(event, identity) {
      return postJoin('/v1/battle/rooms', { event, name: identity.name, wcaId: identity.wcaId, iso2: identity.iso2 });
    },
    joinNetRoom(code, identity) {
      return postJoin(roomPath(code, '/join'), { name: identity.name, wcaId: identity.wcaId, iso2: identity.iso2 });
    },
    async getNetRoom(code, credentials) {
      const path = roomPath(code, credentials ? `?pid=${credentials.playerId}` : '');
      const response = await requestWithTimeout(options.apiUrl(path), credentials ? {
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
    postNetEvent(code, credentials, event) {
      return postState(roomPath(code, '/event'), { pid: credentials.playerId, event }, credentials);
    },
    ensureNetScramble(code, credentials, event) {
      return postState(roomPath(code, '/scramble'), { pid: credentials.playerId, event }, credentials);
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
    nextNetRound(code, credentials, round, force = false) {
      return postState(roomPath(code, '/next'), { pid: credentials.playerId, round, force }, credentials);
    },
    async leaveNetRoom(code, credentials) {
      const response = await requestWithTimeout(options.apiUrl(roomPath(code, '/leave')), {
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
  if (message === 'removed from room') return { zh: '你已被房主移出房间', en: 'The host removed you from the room' };
  if (message === 'invalid battle room code') return { zh: '房间码必须是 4 位数字', en: 'Room code must be exactly four digits' };
  if (message === 'room not found') return { zh: '房间不存在或已过期', en: 'Room not found or expired' };
  if (message === 'room full') return { zh: '房间人数已满', en: 'Room is full' };
  if (message === 'round in progress') return { zh: '本轮正在进行，请等下一轮再加入', en: 'This round is in progress — join on the next round' };
  if (message === 'round already submitted') return { zh: '本轮已经交卷，不能再更换项目', en: 'This round is already submitted, so the event cannot be changed' };
  if (message === 'round already active') return { zh: '本轮已有成绩或正在计时，请下一轮再开启同时起表', en: 'This round already has results or active timers — enable synchronized start next round' };
  if (message === 'player is timing') return { zh: '计时过程中不能更换项目', en: 'You cannot change events while timing' };
  if (message === 'event does not match player') return { zh: '只能填写自己当前项目的打乱', en: 'You can only fill the scramble for your current event' };
  if (message === 'scramble unavailable') return { zh: '打乱暂时生成失败，请重试', en: 'The scramble could not be generated — retry' };
  if (message === 'submit a result before advancing') return { zh: '请先提交本轮成绩', en: 'Submit your result before advancing' };
  if (message === 'players are still solving') return { zh: '还有在线玩家没有完成本轮', en: 'Online players are still solving this round' };
  if (message === 'round is ahead of room') return { zh: '客户端轮次超前，请等待房间同步', en: 'Your round is ahead of the room — wait for it to sync' };
  if (message === 'round limit reached') return { zh: '房间轮次已达上限，请新建房间', en: 'This room reached its round limit — create a new room' };
  if (message === 'wait for next round') return { zh: '本轮已经开始，请等下一轮', en: 'This round has started — wait for the next round' };
  if (message === 'wait for synchronized start') return { zh: '请先等待全员准备完成并同时起表', en: 'Wait for everyone to be ready and the synchronized start' };
  if (message === 'result rejected') return { zh: '本轮成绩未被接受，请刷新房间状态', en: 'The result was not accepted — refresh the room state' };
  if (message === 'name taken') return { zh: '这个名字房里已经有人用了,换一个', en: 'That name is already taken in this room' };
  if (message === 'not admin') return { zh: '你已不是房主了', en: 'You are no longer the host' };
  if (message === 'player not in room') return { zh: 'TA 已经不在房间里了', en: 'That player is no longer in the room' };
  if (message === 'invalid player capability') return { zh: '房间身份已失效，请重新加入', en: 'Your room session expired — rejoin the room' };
  if (error instanceof Error && error.name === 'AbortError' || message === 'request timed out' || message === 'request cancelled') {
    return { zh: '请求超时，请检查网络后重试', en: 'Request timed out — check your connection and retry' };
  }
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
  return netPlayerEvent(state.players[playerId], state.event);
}

export function netPlayerEvent(
  player: NetPlayerEntry | undefined,
  roomDefault: NetBattleEventId,
): NetBattleEventId {
  return player?.event || roomDefault;
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

/** Reject responses from a room lifecycle that has already left or switched codes. */
export function acceptNetRoomResponse(
  activeCode: string | null,
  previous: NetRoomState | null,
  incoming: NetRoomState,
): NetRoomState | null {
  if (activeCode !== incoming.code) return null;
  return preferLatestNetRoomState(previous, incoming);
}

export function isRoundComplete(state: NetRoomState): boolean {
  const roster = new Set(state.roundRoster);
  const online = sortedNetPlayers(state.players).filter((player) => (
    isNetOnline(player, state.now) && (state.startAt === null || roster.has(player.id))
  ));
  if (online.length < 2) return false;
  const results = state.results[String(state.round)] ?? {};
  return online.every((player) => !!results[player.id]);
}

export function pendingCount(state: NetRoomState): number {
  const roster = new Set(state.roundRoster);
  const online = sortedNetPlayers(state.players).filter((player) => (
    isNetOnline(player, state.now) && (state.startAt === null || roster.has(player.id))
  ));
  const results = state.results[String(state.round)] ?? {};
  return online.filter((player) => !results[player.id]).length;
}

/** A synchronized start freezes eligibility even if its roster later becomes empty. */
export function isNetRoundParticipant(
  state: Pick<NetRoomState, 'startAt' | 'roundRoster'>,
  playerId: string | null,
): boolean {
  return !!playerId && (state.startAt === null || state.roundRoster.includes(playerId));
}

/**
 * Manual input may start only outside a server-scheduled countdown. During a
 * synchronized round the server timestamp is the sole start authority; a
 * running timer may still be stopped by its normal timer-machine transition.
 */
export function canManuallyStartNetAttempt(state: NetRoomState, playerId: string | null): boolean {
  if (!playerId
    || state.startAt !== null
    || !isNetRoundParticipant(state, playerId)
    || state.results[String(state.round)]?.[playerId]) return false;
  return !syncGate(state, playerId).gated;
}

export function isNetAdmin(state: NetRoomState, playerId: string | null): boolean {
  return !!playerId && state.admin === playerId;
}

export interface NetSyncGate { gated: boolean; ready: boolean; waiting: number }

/** Exact online, unfinished roster eligible to start a synchronized round. */
export function netReadyRoster(
  state: Pick<NetRoomState, 'players' | 'results' | 'round' | 'now'>,
): string[] | null {
  const results = state.results[String(state.round)] ?? {};
  const contenders = sortedNetPlayers(state.players)
    .filter((player) => isNetOnline(player, state.now) && !results[player.id]);
  if (contenders.length < 2 || !contenders.every((player) => player.ph === 'ready')) return null;
  return contenders.map((player) => player.id);
}

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

export interface NetStats {
  count: number;
  single: number | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  mean: number | null;
}

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
  // Reuse the timer's trimming/DNF rules, preserving online results' ms precision.
  const average = (n: number) => count < n ? null : Math.round(trimmedMean(effective.slice(-n)));
  return { count, single, ao5: average(5), ao12: average(12), ao50: average(50), ao100: average(100), mean };
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
    || !Number.isSafeInteger(value.revision)
    || (value.revision as number) < 1
    || typeof value.videoGeneration !== 'string'
    || !/^[a-f0-9-]{36}$/.test(value.videoGeneration)
    || !Array.isArray(value.roundRoster)
    || !value.roundRoster.every(isNetBattlePlayerId)
    || !isNetBattleEventId(value.event)
    || !Number.isSafeInteger(value.round)
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

  const roundRoster = value.roundRoster as string[];
  if (new Set(roundRoster).size !== roundRoster.length
    || roundRoster.some((id) => !players[id])) {
    throw new Error('invalid battle room response');
  }

  const results: Record<string, Record<string, NetResult>> = {};
  for (const [round, raw] of Object.entries(value.results)) {
    if (!/^[1-9]\d*$/.test(round)) throw new Error('invalid battle room response');
    results[round] = decodeResults(raw);
  }

  const history: NetRoundHistory[] = value.history.map((raw) => {
    if (!isRecord(raw)
      || !Number.isSafeInteger(raw.round)
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
      || !Number.isSafeInteger(score)
      || score < 0) throw new Error('invalid battle room response');
    scores[id] = score;
  }

  return {
    code: value.code,
    revision: value.revision as number,
    videoGeneration: value.videoGeneration,
    roundRoster,
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

export const TIMER_NET_SCRAMBLE_COPY = {
  en: { action: 'Copy original scramble', copied: 'Copied the scramble', failed: 'Copy failed. Try again.', loading: 'Generating scramble…' },
  zh: { action: '复制原打乱', copied: '已复制原打乱', failed: '复制失败，请重试', loading: '生成打乱中…' },
};

export const TIMER_ROOM_LOBBY_COPY = {
  en: { title: 'Online battle', create: 'Create room', join: 'Join room', recent: 'Recent rooms', code: 'Room code', joining: 'Opening room…', retry: 'Retry', own: 'Create my own room', exit: 'Exit online mode' },
  zh: { title: '联机对战', create: '创建房间', join: '加入房间', recent: '最近房间', code: '房间码', joining: '正在进入房间…', retry: '重试', own: '创建自己的房间', exit: '退出联机' },
};

export const TIMER_ROOM_TOOLBAR_COPY = {
  en: { round: 'Round', room: 'Room', sync: 'Synchronized start', code: 'Copy room code', invite: 'Copy invite link', copiedCode: 'Room code copied', copiedInvite: 'Invite link copied', qr: 'Room QR code', history: 'Scramble history and results', admin: 'Room settings', timerSettings: 'Timer settings', leave: 'Leave room', confirmLeave: 'Confirm leaving the room' },
  zh: { round: '轮次', room: '房间', sync: '同时开始计时', code: '复制房间码', invite: '复制邀请链接', copiedCode: '已复制房间码', copiedInvite: '已复制邀请链接', qr: '房间二维码', history: '历史打乱与战绩', admin: '房间管理', timerSettings: '计时设置', leave: '离开房间', confirmLeave: '确认离开房间' },
};

export const TIMER_ROOM_ROUND_STATUS_COPY = {
  en: { ready: "I'm ready", cancel: 'Cancel ready', skip: 'Skip to next round', confirmSkip: 'Confirm skipping unfinished solves', next: 'Next round', noResult: 'No valid result this round', pending: (n: number) => `Waiting for others to finish (${n} left)…`, waiting: (n: number) => `Waiting for others to get ready (${n} left)…`, sync: 'A 3s countdown begins once everyone is ready', auto: 'Auto-ready is off during a synchronized start. Tap ready; the cube stops the timer when solved.', spectator: 'This round has started. You can watch and join the next round.', countdown: 'Starting together — get ready!' },
  zh: { ready: '我准备好了', cancel: '取消准备', skip: '跳过等待，开下一轮', confirmSkip: '确认跳过未完成的还原', next: '下一轮', noResult: '本轮无有效成绩', pending: (n: number) => `等待其他玩家完成（还差 ${n} 人）…`, waiting: (n: number) => `等其他人准备（还差 ${n} 人）…`, sync: '全员准备后，3 秒倒计时一起开始', auto: '同时起表期间不自动预备，请手动准备；魔方还原时停表。', spectator: '本轮已经开始，你可以旁观并等待下一轮', countdown: '一起起表，准备！' },
};

export const TIMER_ROOM_ADMIN_COPY = {
  en: { title: 'Room settings', sync: 'Synchronized start', me: '(me)', host: 'Host', transfer: 'Make host', kick: 'Remove', confirm: 'Confirm removal', confirmTransfer: 'Confirm host transfer' },
  zh: { title: '房间管理', sync: '同时开始计时', me: '（我）', host: '房主', transfer: '设为房主', kick: '移出房间', confirm: '确认移出', confirmTransfer: '确认转让房主' },
};

export const TIMER_ROOM_PLAYERS_COPY = {
  en: { players: 'Players', me: '(me)', host: 'Host', score: 'Score', view: 'View cube', rename: 'Change name', offline: 'Offline', ready: 'Ready', inspecting: 'Inspecting', waiting: 'Waiting to start' },
  zh: { players: '玩家', me: '（我）', host: '房主', score: '得分', view: '查看魔方', rename: '改名', offline: '离线', ready: '已准备', inspecting: '观察中', waiting: '待开始' },
};

export const TIMER_NET_PK_RESULT_COPY = {
  en: { wins: (count: number) => `${count} ${count === 1 ? 'win' : 'wins'}`, winner: 'Round winner', gap: (value: string) => `Time difference ${value}` },
  zh: { wins: (count: number) => `${count} 胜`, winner: '本轮获胜', gap: (value: string) => `时间差 ${value}` },
};

export function timerRoomPlayerName(player: { name: string; wcaId?: string }, language: 'en' | 'zh'): string {
  if (!player.wcaId) return player.name;
  const base = player.name.replace(/ \(\d+\)$/, '');
  return displayCuberName(base, language === 'zh') + player.name.slice(base.length);
}

export const TIMER_ROOM_HISTORY_COPY = {
  en: { title: 'Scramble history and results', copy: 'Copy standings', copied: 'Standings copied', replay: 'View reconstruction', rank: 'Rank', event: 'Event', player: 'Player', wins: 'Wins', best: 'Best', mean: 'Mean', history: 'Scramble history', round: 'Round', live: 'In progress', noScramble: 'No scramble', unknown: 'Former player', cube: 'Scramble preview' },
  zh: { title: '历史打乱与战绩', copy: '复制战报', copied: '已复制战报', replay: '查看复盘', rank: '名次', event: '项目', player: '选手', wins: '胜场', best: '最佳', mean: '平均', history: '历史打乱', round: '轮次', live: '进行中', noScramble: '打乱未生成', unknown: '已离开玩家', cube: '打乱预览' },
};

export function formatNetHistoryStat(value: number | null, precision: 0 | 1 | 2 | 3) {
  return value === null ? '—' : !Number.isFinite(value) ? 'DNF' : formatMs(value, precision);
}
export function formatNetHistoryResult(result: NetResult | undefined, precision: 0 | 1 | 2 | 3) {
  return !result ? '—' : result.p === 'dnf' ? 'DNF' : formatMs(effectiveNetMs(result), precision) + (result.p === '+2' ? '+' : '');
}

export function netRoomStandings(room: NetRoomState) {
  const players = sortedNetPlayers(room.players).sort((a, b) => (room.scores[b.id] ?? 0) - (room.scores[a.id] ?? 0));
  let rank = 0;
  let previousWins: number | undefined;
  return players.map((player, index) => {
    const wins = room.scores[player.id] ?? 0;
    if (wins !== previousWins) rank = index + 1;
    previousWins = wins;
    return { player, rank, wins, event: playerEventOf(room, player.id), stats: playerStats(playerTimeline(room, player.id)) };
  });
}

export function formatNetRoomStandings(
  room: NetRoomState, language: 'en' | 'zh', precision: 0 | 1 | 2 | 3,
  standings = netRoomStandings(room),
): string {
  const copy = TIMER_ROOM_HISTORY_COPY[language];
  const heading = TIMER_ROOM_TOOLBAR_COPY[language];
  return [
    heading.room + ' ' + room.code + ' · ' + heading.round + ' ' + room.round,
    [copy.rank, copy.player, copy.event, copy.wins, copy.best, 'ao5', 'ao12', copy.mean].join('\t'),
    ...standings.map(({ rank, player, event, wins, stats }) => [
      rank, timerRoomPlayerName(player, language).replace(/\s+/g, ' ').trim(), timerEventPickerName(event, language), wins,
      ...[stats.single, stats.ao5, stats.ao12, stats.mean].map(value => formatNetHistoryStat(value, precision)),
    ].join('\t')),
  ].join('\n');
}
