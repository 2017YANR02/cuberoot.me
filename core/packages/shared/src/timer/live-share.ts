import { EVENTS, type EventId, type Solve, type SolveMove, type Penalty } from './types';
import { decodeTimerSolve } from './persistence';
import type { TimerPhase } from './machine';
import type { Quat } from '../smart_cube/orientation';
import type { GyroSample } from '../smart_cube/gyro_track';
import type { SmartCubeAttemptProducer } from './smart-cube-attempt';
import { normalizeTimerTypography, type TimerTypographySettings } from './typography';
import { normalizeSoloLayout, type SoloLayout } from './solo-layout';
import type { SmartCubeScrambleHint } from '../smart_cube/scramble_hint';

export const TIMER_LIVE_PATH = '/v1/timer/live-shares';
export const TIMER_LIVE_MAX_BYTES = 2 * 1024 * 1024;
export const TIMER_LIVE_TTL_MS = 4 * 60 * 60 * 1000;
export const TIMER_LIVE_STALE_MS = 8_000;
export interface TimerLiveCredential { id: string; token: string }
export interface TimerLiveSession extends TimerLiveCredential { viewerToken: string; expiresAt: number }
export interface TimerLiveAttempt { solve: Solve; gyro: readonly GyroSample[] }
export interface TimerLiveState {
  controls?: { contentId: string; source: 'wca' | 'random' | 'manual' };
  guidance?: { hint: SmartCubeScrambleHint | null; correctionActive: boolean; match: boolean | null };
  /** Presentation only; older publishers use the normal timer defaults. */
  appearance?: TimerTypographySettings & { soloLayout: SoloLayout };
  context: string;
  sessionName: string;
  event: EventId;
  scramble: string;
  phase: TimerPhase;
  elapsedMs: number;
  inspectionMs: number;
  inspectionSec: number;
  sampledAt: number;
  lastPenalty: Penalty | null;
  trainingObservation: boolean;
  timingEnabled: boolean;
  hideTime: boolean;
  precision: 0 | 1 | 2 | 3;
  runningPrecision: 0 | 1 | 2 | 3;
}
export interface TimerLiveCube { connected: boolean; facelets: string | null; quaternion: Quat | null; moves: readonly string[]; algAnchored: boolean }
export interface TimerLiveSnapshot {
  state: TimerLiveState;
  cube: TimerLiveCube;
  attempt: TimerLiveAttempt | null;
  history: Solve[];
}
export interface TimerLiveAttemptPatch {
  solve: Solve;
  moveFrom: number;
  moves: SolveMove[];
  gyroFrom: number;
  gyro: readonly GyroSample[];
}
export interface TimerLivePatch {
  state?: TimerLiveState;
  cube?: TimerLiveCube;
  attempt?: TimerLiveAttemptPatch | null;
  history?: Solve[];
}
export type TimerLivePublication = { type: 'snapshot'; snapshot: TimerLiveSnapshot }
  | { type: 'patch'; base: number; patch: TimerLivePatch };
export type TimerLiveConnection = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'ended' | 'error';
export interface TimerLiveSource {
  snapshot(): TimerLiveSnapshot;
  detail(id: string, context: string): Solve | null;
}

export const TIMER_LIVE_SHARE_COPY = {
  title: { en: 'Live sharing', zh: '实时分享' },
  description: { en: 'Share up to the latest 200 solves in this session, timer and smart-cube reconstruction. Anyone with the link can watch. Expires after 4 hours.',
    zh: '分享当前分组最近最多 200 条成绩、计时与智能魔方复原过程。持有链接的人可以观看，4 小时后失效。' },
  create: { en: 'Create share link', zh: '生成分享链接' },
  creating: { en: 'Creating…', zh: '正在创建…' },
  copy: { en: 'Copy link', zh: '复制链接' },
  copied: { en: 'Copied', zh: '已复制' },
  qr: { en: 'QR code', zh: '二维码' },
  end: { en: 'End sharing', zh: '结束分享' },
  paused: { en: 'Sharing paused', zh: '分享已暂停' },
  disconnected: { en: 'Sharing disconnected', zh: '分享连接已断开' },
  connecting: { en: 'Reconnecting…', zh: '正在连接…' },
  unavailable: { en: 'Sharing unavailable. End this share and try again.', zh: '分享不可用，请结束后重新创建。' },
  revokeError: { en: 'Link revocation failed. Retry End sharing.', zh: '链接撤销失败，请重试“结束分享”。' },
  error: { en: 'Operation failed. Please retry.', zh: '操作失败，请重试。' },
  watching: (viewers: number) => ({ en: `${viewers} watching`, zh: `${viewers} 人观看` }),
};

export const isTimerLiveId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{22}$/.test(v);
export const isTimerLiveToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
export const isTimerLiveShortToken = (v: unknown): boolean => typeof v === 'string' && /^[A-Za-z0-9_-]{21}[AQgw]$/.test(v);
export const isTimerLiveViewerToken = (v: unknown): v is string => isTimerLiveToken(v) || isTimerLiveShortToken(v);
export function parseTimerLiveSession(value: unknown, now = Date.now()): TimerLiveSession | null {
  if (!record(value)) return null;
  const { id, token, viewerToken, expiresAt } = value;
  return isTimerLiveId(id) && isTimerLiveToken(token) && isTimerLiveViewerToken(viewerToken)
    && typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > now
    ? { id, token, viewerToken, expiresAt } : null;
}
/** A one-way room locator: knowing the room ID does not grant viewer access. */
export async function timerLiveShortId(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`timer-live:${token}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 16)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 9e15;
const eventIds = new Set<string>(EVENTS.map(e => e.id));
const eventId = (v: unknown): v is EventId => typeof v === 'string' && eventIds.has(v);
const phases = new Set(['idle', 'holding', 'ready', 'inspecting', 'running', 'stopped']);
function parseGuidance(v: unknown): TimerLiveState['guidance'] {
  if (!record(v) || typeof v.correctionActive !== 'boolean' || !(v.match === null || typeof v.match === 'boolean')) return;
  if (v.hint === null) return { hint: null, correctionActive: v.correctionActive, match: v.match };
  const h = v.hint;
  const moves = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every(m => text(m, 32));
  if (!record(h) || !moves(h.done) || !moves(h.pending) || !(h.current === null || text(h.current, 32))
    || typeof h.complete !== 'boolean' || (h.corrections !== undefined && !moves(h.corrections))) return;
  if (h.displayMoves !== undefined && (!Array.isArray(h.displayMoves) || h.displayMoves.length > 2000
    || !h.displayMoves.every(m => record(m) && Number.isSafeInteger(m.id) && Number(m.id) >= 0
      && text(m.move, 32) && text(m.token, 32) && ['done', 'current', 'pending', 'correction'].includes(String(m.state))))) return;
  return { correctionActive: v.correctionActive, match: v.match, hint: {
    done: h.done, pending: h.pending, current: h.current, complete: h.complete,
    ...(h.corrections !== undefined && { corrections: h.corrections as string[] }),
    ...(Array.isArray(h.displayMoves) && { displayMoves: h.displayMoves.map(m => ({ id: m.id, move: m.move, token: m.token, state: m.state })) }),
  } };
}
function quat(v: unknown): v is Quat | null {
  return v === null || record(v) && [v.w, v.x, v.y, v.z].every(n => typeof n === 'number' && Number.isFinite(n))
    && Math.abs(Math.hypot(v.w as number, v.x as number, v.y as number, v.z as number) - 1) < .02;
}
function solve(v: unknown): Solve | null {
  if (!record(v) || !eventId(v.event) || !text(v.scramble, 20_000)
    || (v.moves !== undefined && (!Array.isArray(v.moves) || v.moves.length > 10_000))
    || (v.gyro !== undefined && !text(v.gyro, 200_000))) return null;
  return decodeTimerSolve(v, v.event);
}
function gyro(v: unknown): v is GyroSample[] {
  return Array.isArray(v) && v.length <= 8192 && v.every(s => record(s) && number(s.tMs)
    && s.q !== null && quat(s.q) && (s.frame === undefined || s.frame === 'scramble'));
}
/** Whitelist the shared lesson data; never send local device identifiers or private notes. */
export function timerLiveSolveSummary(s: Solve): Solve {
  return { id: s.id, event: s.event, timeMs: s.timeMs, penalty: s.penalty, ts: s.ts, scramble: s.scramble,
    ...(s.mbld && { mbld: s.mbld }), ...(s.stages && { stages: s.stages }),
    ...(s.bld && { bld: s.bld }), ...(s.inspectionMs !== undefined && { inspectionMs: s.inspectionMs }),
    ...(s.trainingStartMode && { trainingStartMode: s.trainingStartMode }) };
}
export function timerLiveSolveDetail(s: Solve): Solve {
  return { ...timerLiveSolveSummary(s), ...(s.moves && { moves: s.moves }), ...(s.gyro && { gyro: s.gyro }),
    ...(s.device && { device: { model: s.device.model, name: s.device.model } }),
    ...(s.stageSegments && { stageSegments: s.stageSegments }), ...(s.caseId && { caseId: s.caseId }),
    ...(s.pllChain && { pllChain: s.pllChain }) };
}
function parseSnapshot(v: unknown, previous?: TimerLiveSnapshot): TimerLiveSnapshot | null {
  if (!record(v) || !record(v.state) || !record(v.cube)) return null;
  const s = v.state, c = v.cube;
  if (!text(s.context, 256) || !text(s.sessionName, 200) || !eventId(s.event) || !text(s.scramble, 20_000)
    || typeof s.phase !== 'string' || !phases.has(s.phase)
    || ![s.elapsedMs, s.inspectionMs, s.inspectionSec, s.sampledAt].every(number)
    || ![null, 'ok', '+2', 'DNF', 'DNS'].includes(s.lastPenalty as Penalty | null) || typeof s.trainingObservation !== 'boolean'
    || typeof s.timingEnabled !== 'boolean' || typeof s.hideTime !== 'boolean'
    || ![0, 1, 2, 3].includes(s.precision as number) || ![0, 1, 2, 3].includes(s.runningPrecision as number)
    || typeof c.connected !== 'boolean' || !(c.facelets === null || typeof c.facelets === 'string' && /^[URFDLB]{54}$/.test(c.facelets))
    || typeof c.algAnchored !== 'boolean' || !Array.isArray(c.moves) || c.moves.length > 10_000 || !c.moves.every(m => text(m, 16))
    || !quat(c.quaternion) || !Array.isArray(v.history) || v.history.length > 200) return null;
  const history: Solve[] = v.history === previous?.history ? previous.history : [];
  if (v.history !== previous?.history) for (const item of v.history) { const decoded = solve(item); if (!decoded) return null; history.push(timerLiveSolveSummary(decoded)); }
  let attempt: TimerLiveAttempt | null = null;
  if (previous && v.attempt === previous.attempt) attempt = previous.attempt;
  else if (v.attempt !== null) {
    if (!record(v.attempt) || !gyro(v.attempt.gyro)) return null;
    const decoded = solve(v.attempt.solve);
    if (!decoded) return null;
    attempt = { solve: timerLiveSolveDetail(decoded), gyro: v.attempt.gyro };
  }
  return { state: previous && Object.is(v.state, previous.state) ? previous.state : { context: s.context, sessionName: s.sessionName, event: s.event, scramble: s.scramble,
    phase: s.phase as TimerPhase, elapsedMs: s.elapsedMs as number, inspectionMs: s.inspectionMs as number,
    inspectionSec: s.inspectionSec as number, sampledAt: s.sampledAt as number,
    lastPenalty: s.lastPenalty as Penalty | null, trainingObservation: s.trainingObservation, timingEnabled: s.timingEnabled, hideTime: s.hideTime,
    precision: s.precision as TimerLiveState['precision'], runningPrecision: s.runningPrecision as TimerLiveState['runningPrecision'],
    ...(record(s.appearance) && { appearance: { ...normalizeTimerTypography(s.appearance), soloLayout: normalizeSoloLayout(s.appearance.soloLayout) } }),
    ...(record(s.controls) && text(s.controls.contentId, 100) && ['wca', 'random', 'manual'].includes(String(s.controls.source))
      && { controls: { contentId: s.controls.contentId, source: s.controls.source as 'wca' | 'random' | 'manual' } }),
    ...(s.guidance !== undefined && { guidance: parseGuidance(s.guidance) }) },
  cube: previous && Object.is(v.cube, previous.cube) ? previous.cube : { connected: c.connected, facelets: c.facelets, quaternion: c.quaternion, moves: c.moves, algAnchored: c.algAnchored }, attempt, history };
}

export function parseTimerLiveSnapshot(v: unknown): TimerLiveSnapshot | null { return parseSnapshot(v); }

/** Bounded lesson history keeps live traffic independent of a student’s full archive. */
export function timerLiveHistory(solves: Solve[], measureBytes = (value: string) => new TextEncoder().encode(value).byteLength): Solve[] {
  const recent = solves.slice().sort((a, b) => b.ts - a.ts).slice(0, 200);
  const result: Solve[] = [];
  let bytes = 0;
  for (const solve of recent) {
    const summary = timerLiveSolveSummary(solve);
    bytes += measureBytes(JSON.stringify(summary));
    if (bytes > 512 * 1024) break;
    result.push(summary);
  }
  return result.reverse();
}
export interface TimerLiveCompletion { context: string; solve: Solve }
export function timerLiveCompletedAttempt(completed: TimerLiveCompletion | null, context: string, event: EventId): TimerLiveAttempt | null {
  return completed?.context === context && completed.solve.event === event && completed.solve.moves?.length
    ? { solve: timerLiveSolveDetail(completed.solve), gyro: [] } : null;
}

export function captureTimerLiveAttempt(producer: SmartCubeAttemptProducer,
  context: { startedAt: number; event: EventId; scramble: string; trainingStartMode?: Solve['trainingStartMode'] } | null): TimerLiveAttempt | null {
  if (!context) return null;
  const data = producer.snapshotLive();
  if (!data.moves.length) return null;
  return { solve: timerLiveSolveDetail({ id: `live-${context.startedAt}`, event: context.event, scramble: context.scramble,
    ts: 0, timeMs: data.moves.at(-1)?.ts ?? 0, penalty: 'ok', moves: data.moves, device: data.device,
    ...(context.trainingStartMode && { trainingStartMode: context.trainingStartMode }) }), gyro: data.gyroSamples };
}
export function parseTimerLiveDetail(v: unknown): Solve | null { const s = solve(v); return s && timerLiveSolveDetail(s); }

function prefix<T>(a: readonly T[], b: readonly T[]): number {
  let i = 0;
  while (i < a.length && i < b.length && JSON.stringify(a[i]) === JSON.stringify(b[i])) i++;
  return i;
}
export function diffTimerLiveSnapshot(previous: TimerLiveSnapshot, next: TimerLiveSnapshot): TimerLivePatch {
  const patch: TimerLivePatch = {};
  // A clock sample each second; phase/context changes bypass this throttle.
  const { elapsedMs: _e, inspectionMs: _i, sampledAt: _t, ...before } = previous.state;
  const { elapsedMs: _e2, inspectionMs: _i2, sampledAt: _t2, ...after } = next.state;
  if (JSON.stringify(before) !== JSON.stringify(after) || next.state.sampledAt - previous.state.sampledAt >= 1000
    || !['running', 'inspecting', 'holding'].includes(next.state.phase) && next.state.elapsedMs !== previous.state.elapsedMs) patch.state = next.state;
  if (JSON.stringify(previous.cube) !== JSON.stringify(next.cube)) patch.cube = next.cube;
  if (previous.history !== next.history) patch.history = next.history;
  if (!next.attempt) { if (previous.attempt) patch.attempt = null; }
  else {
    const old = previous.attempt?.solve.id === next.attempt.solve.id ? previous.attempt : null;
    const moves = next.attempt.solve.moves ?? [];
    const moveFrom = prefix(old?.solve.moves ?? [], moves);
    const gyroFrom = prefix(old?.gyro ?? [], next.attempt.gyro);
    const { moves: _moves, ...metadata } = next.attempt.solve;
    const { moves: _oldMoves, ...oldMetadata } = old?.solve ?? {};
    if (!old || JSON.stringify(metadata) !== JSON.stringify(oldMetadata) || moveFrom !== moves.length || moveFrom !== (old.solve.moves?.length ?? 0)
      || gyroFrom !== next.attempt.gyro.length || gyroFrom !== old.gyro.length) {
      patch.attempt = { solve: { ...next.attempt.solve, moves: undefined }, moveFrom, moves: moves.slice(moveFrom),
        gyroFrom, gyro: next.attempt.gyro.slice(gyroFrom) };
    }
  }
  return patch;
}

/** One acknowledged publication at a time on both the browser and native relay. */
export function createTimerLivePublisher(options: {
  source: TimerLiveSource;
  send(message: unknown): boolean;
  now(): number;
}) {
  let ready = false, revision = 0, offset = 0, bestRtt = Infinity, sentAt = -Infinity;
  let last: TimerLiveSnapshot | null = null, pending: TimerLiveSnapshot | null = null;
  let forceSnapshot = false;
  const { source, send, now } = options;
  const ping = () => { if (ready) send({ type: 'ping', sentAt: now() }); };
  function flush() {
    const time = now();
    if (!ready || pending || time - sentAt < 40) return;
    const sample = source.snapshot();
    const next = { ...sample, state: { ...sample.state, sampledAt: sample.state.sampledAt + offset } };
    if (!last) {
      if (send({ type: 'snapshot', snapshot: next } satisfies TimerLivePublication)) { pending = next; sentAt = time; }
      return;
    }
    const patch = diffTimerLiveSnapshot(last, next);
    if (!Object.keys(patch).length) return;
    if (send({ type: 'patch', base: revision, patch } satisfies TimerLivePublication)) {
      pending = { state: patch.state ?? last.state, cube: patch.cube ?? last.cube, history: patch.history ?? last.history,
        attempt: patch.attempt !== undefined ? next.attempt : last.attempt };
      sentAt = time;
    }
  }
  return {
    flush, ping,
    refresh() { if (pending) forceSnapshot = true; else last = null; ping(); flush(); },
    receive(message: Record<string, unknown>) {
      if (message.type === 'ready') {
        ready = true;
        if (typeof message.serverNow === 'number' && Number.isFinite(message.serverNow)) offset = message.serverNow - now();
        ping(); flush();
      } else if (message.type === 'pong' && typeof message.sentAt === 'number' && typeof message.serverNow === 'number') {
        const rtt = now() - message.sentAt;
        if (rtt >= 0 && rtt < bestRtt) { bestRtt = rtt; offset = message.serverNow - (message.sentAt + rtt / 2); }
      } else if (message.type === 'ack' && Number.isSafeInteger(message.revision) && pending) {
        last = forceSnapshot ? null : pending; pending = null; forceSnapshot = false;
        revision = message.revision as number; flush();
      } else if (message.type === 'resync') {
        last = pending = null; forceSnapshot = false; flush();
      } else if (message.type === 'detail' && typeof message.solveId === 'string'
        && typeof message.context === 'string' && typeof message.requestId === 'string') {
        const solve = source.detail(message.solveId, message.context);
        if (solve) send({ type: 'detail', context: message.context, requestId: message.requestId, solve: timerLiveSolveDetail(solve) });
      }
    },
  };
}
/** Applies only ordered deltas. Validation also bounds the assembled state, not just each packet. */
export function applyTimerLivePatch(previous: TimerLiveSnapshot, raw: unknown): TimerLiveSnapshot | null {
  if (!record(raw) || Object.keys(raw).some(k => !['state', 'cube', 'attempt', 'history'].includes(k))) return null;
  let attempt = previous.attempt;
  if (raw.attempt === null) attempt = null;
  else if (raw.attempt !== undefined) {
    const p = raw.attempt;
    if (!record(p) || !record(p.solve) || !Number.isSafeInteger(p.moveFrom) || !Number.isSafeInteger(p.gyroFrom)
      || !Array.isArray(p.moves) || !gyro(p.gyro)) return null;
    const old = previous.attempt?.solve.id === p.solve.id ? previous.attempt : null;
    const moveFrom = p.moveFrom as number, gyroFrom = p.gyroFrom as number;
    if (moveFrom < 0 || moveFrom > (old?.solve.moves?.length ?? 0) || gyroFrom < 0 || gyroFrom > (old?.gyro.length ?? 0)) return null;
    attempt = { solve: { ...p.solve, moves: [...(old?.solve.moves ?? []).slice(0, moveFrom), ...p.moves] } as Solve,
      gyro: [...(old?.gyro ?? []).slice(0, gyroFrom), ...p.gyro] };
  }
  return parseSnapshot({ ...previous, ...raw, attempt }, previous);
}
export function timerLiveWatchUrl(base: string, session: TimerLiveSession): string {
  const url = new URL(base);
  url.hash = timerLiveWatchFragment(session);
  return url.toString();
}
export function timerLiveWatchFragment(session: TimerLiveSession): string {
  return isTimerLiveShortToken(session.viewerToken) ? session.viewerToken : `${session.id}.${session.viewerToken}`;
}
export async function parseTimerLiveWatchHash(hash: string): Promise<TimerLiveCredential | null> {
  const value = hash.replace(/^#/, '');
  if (isTimerLiveShortToken(value)) return { id: await timerLiveShortId(value), token: value };
  const parts = value.split('.');
  const [id, token] = parts;
  return parts.length === 2 && isTimerLiveId(id) && isTimerLiveToken(token) ? { id, token } : null;
}
