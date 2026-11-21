import {turnEvents,type TurnEvent} from './tps';
import { RECONSTRUCTION_TIMEOUT_MS, type MoveSearchResult } from './move-search-types';

export const TIMER_HOLD_MS = 300;
export const TIMER_TAIL_SECONDS = 0.3;
export const TIMER_SEARCH_LIMIT_MS = RECONSTRUCTION_TIMEOUT_MS;
export type Penalty = 'none' | '+2' | 'DNF';
export interface TimerReconstructionResult {
  status: 'collecting' | 'waiting' | 'queued' | 'searching' | 'solved' | 'failed';
  message?: string;
  frames?: number;
  moves?: string[];
  turnEvents?: TurnEvent[];
  config?: { scramble: string; fps: number; source_fps?:number;frame_clock?:'camera_milliseconds';requested_start_seconds: number; source_origin_seconds: number; source_end_seconds: number };
  result?: MoveSearchResult;
  diagnosticRunId?: string;
}
export interface TimerSolve {
  id: string;
  scramble: string;
  startedAt: string;
  elapsedMs: number;
  penalty: Penalty;
  reconstruction?: TimerReconstructionResult;
}
export function timerReconstructionStatus(value?:TimerReconstructionResult):{label:string;kind:'idle'|'searching'|'solved'|'time-limit'|'failed'}{
  if(!value)return {label:'Ready',kind:'idle'};
  if(value.status==='solved')return {label:'Full reconstruction',kind:'solved'};
  if(value.status==='failed'){
    if(/timed out|time limit/i.test(value.message??''))return {label:'Reconstruction failed · Timed out',kind:'time-limit'};
    return {label:'Reconstruction failed',kind:'failed'};
  }
  return {label:'Searching',kind:'searching'};
}
export function compactTimerReconstruction(value: TimerReconstructionResult | undefined): TimerReconstructionResult | undefined {
  if (!value) return;
  return { status:value.status,message:value.message,frames:value.frames,config:value.config,
    diagnosticRunId:value.diagnosticRunId,
    moves:['solved','failed'].includes(value.status)?value.moves:undefined,
    turnEvents:['solved','failed'].includes(value.status)
      ?value.turnEvents??(value.result&&value.config?turnEvents(value.result.steps,value.config.fps):undefined):undefined };
}

/** The same monotonic clock drives keyboard and pointer input. */
export class CubeTimerClock {
  phase: 'idle' | 'holding' | 'running' = 'idle';
  heldAt = 0;
  startedAt = 0;
  elapsedMs = 0;
  press(code: string, now: number, editable = false, repeat = false): 'stop' | undefined {
    if (repeat) return;
    // Every new key stops a solve, even if a form control has focus.
    if (this.phase === 'running') {
      this.elapsedMs = Math.max(0, now - this.startedAt);
      this.phase = 'idle';
      return 'stop';
    }
    if (code === 'Space' && !editable && this.phase === 'idle') {
      this.phase = 'holding'; this.heldAt = now;
    }
  }
  release(code: string, now: number): boolean {
    if (code !== 'Space' || this.phase !== 'holding') return false;
    this.phase = 'idle';
    if (now - this.heldAt < TIMER_HOLD_MS) return false;
    this.startedAt = now; this.elapsedMs = 0; this.phase = 'running';
    return true;
  }
  cancelHold() { if (this.phase === 'holding') this.phase = 'idle'; }
}

export function solveTime(solve: Pick<TimerSolve, 'elapsedMs' | 'penalty'>): number {
  return solve.penalty === 'DNF' ? Infinity : solve.elapsedMs + (solve.penalty === '+2' ? 2000 : 0);
}
export function formatTimer(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (!Number.isFinite(ms)) return 'DNF';
  const centiseconds = Math.floor(Math.max(0, ms) / 10);
  const seconds = Math.floor(centiseconds / 100);
  return `${seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : seconds}.${String(centiseconds % 100).padStart(2, '0')}`;
}
/** Drop one best and one worst; a second DNF makes the average DNF. */
export function timerAverage(solves: readonly TimerSolve[], count: number): number | undefined {
  if (solves.length < count) return;
  const times = solves.slice(-count).map(solveTime).sort((a, b) => a - b).slice(1, -1);
  return times.reduce((a, b) => a + b, 0) / times.length;
}
export function timerSessionRows(solves: readonly TimerSolve[]) {
  return solves.map((solve, index) => ({
    solve, number: index + 1,
    ao5: timerAverage(solves.slice(Math.max(0, index - 4), index + 1), 5),
    ao12: timerAverage(solves.slice(Math.max(0, index - 11), index + 1), 12),
  }));
}
export function readTimerSolves(raw: string | null): TimerSolve[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((s): s is TimerSolve => !!s && typeof s.id === 'string' && typeof s.scramble === 'string' &&
      typeof s.startedAt === 'string' && Number.isFinite(s.elapsedMs) && s.elapsedMs >= 0 && ['none', '+2', 'DNF'].includes(s.penalty));
  } catch { return []; }
}
