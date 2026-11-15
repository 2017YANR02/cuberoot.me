import { EVENTS, type EventId, type Solve, type SolveMove, type Penalty } from './types';
import { decodeTimerSolve } from './persistence';
import type { TimerPhase } from './machine';
import type { Quat } from '../smart_cube/orientation';
import type { GyroSample } from '../smart_cube/gyro_track';
import type { SmartCubeAttemptProducer } from './smart-cube-attempt';

export const TIMER_LIVE_PATH = '/v1/timer/live-shares';
export const TIMER_LIVE_MAX_BYTES = 2 * 1024 * 1024;
export const TIMER_LIVE_TTL_MS = 4 * 60 * 60 * 1000;
export const TIMER_LIVE_STALE_MS = 8_000;
export interface TimerLiveCredential { id: string; token: string }
export interface TimerLiveSession extends TimerLiveCredential { viewerToken: string; expiresAt: number }
export interface TimerLiveAttempt { solve: Solve; gyro: readonly GyroSample[] }
export interface TimerLiveState {
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

export const isTimerLiveId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{22}$/.test(v);
export const isTimerLiveToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 9e15;
const eventIds = new Set<string>(EVENTS.map(e => e.id));
const eventId = (v: unknown): v is EventId => typeof v === 'string' && eventIds.has(v);
const phases = new Set(['idle', 'holding', 'ready', 'inspecting', 'running', 'stopped']);
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
    precision: s.precision as TimerLiveState['precision'], runningPrecision: s.runningPrecision as TimerLiveState['runningPrecision'] },
  cube: previous && Object.is(v.cube, previous.cube) ? previous.cube : { connected: c.connected, facelets: c.facelets, quaternion: c.quaternion, moves: c.moves, algAnchored: c.algAnchored }, attempt, history };
}

export function parseTimerLiveSnapshot(v: unknown): TimerLiveSnapshot | null { return parseSnapshot(v); }

/** Bounded lesson history keeps live traffic independent of a student’s full archive. */
export function timerLiveHistory(solves: Solve[]): Solve[] {
  const recent = solves.slice().sort((a, b) => b.ts - a.ts).slice(0, 200);
  const result: Solve[] = [];
  let bytes = 0;
  for (const solve of recent) {
    const summary = timerLiveSolveSummary(solve);
    bytes += new TextEncoder().encode(JSON.stringify(summary)).byteLength;
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
  const url = new URL(base); url.hash = `${session.id}.${session.viewerToken}`; return url.toString();
}
export function parseTimerLiveWatchHash(hash: string): TimerLiveCredential | null {
  const [id, token, extra] = hash.replace(/^#/, '').split('.');
  return !extra && isTimerLiveId(id) && isTimerLiveToken(token) ? { id, token } : null;
}
