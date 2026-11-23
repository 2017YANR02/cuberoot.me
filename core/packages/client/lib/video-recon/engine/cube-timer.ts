import {turnEvents,type TurnEvent} from './tps';
import { RECONSTRUCTION_TIMEOUT_MS, type MoveSearchResult } from './move-search-types';

export const TIMER_TAIL_SECONDS = 0.3;
export const TIMER_CAMERA_END_VIEW_SECONDS = 2;
export const TIMER_SEARCH_LIMIT_MS = RECONSTRUCTION_TIMEOUT_MS;
export type Penalty = 'none' | '+2' | 'DNF';
export interface TimerReconstructionResult {
  status: 'collecting' | 'waiting' | 'queued' | 'searching' | 'solved' | 'failed';
  message?: string;
  frames?: number;
  moves?: string[];
  turnEvents?: TurnEvent[];
  config?: { scramble: string; fps: number; source_fps?:number;frame_clock?:'camera_milliseconds';turning_start_frame?:number|null;
    requested_start_seconds: number; requested_stop_seconds?: number; source_origin_seconds: number; source_end_seconds: number };
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
export function compactTimerReconstruction(value: TimerReconstructionResult | undefined): TimerReconstructionResult | undefined {
  if (!value) return;
  return { status:value.status,message:value.message,frames:value.frames,config:value.config,
    diagnosticRunId:value.diagnosticRunId,
    moves:['solved','failed'].includes(value.status)?value.moves:undefined,
    turnEvents:['solved','failed'].includes(value.status)
      ?value.turnEvents??(value.result&&value.config?turnEvents(value.result.steps,value.config.fps):undefined):undefined };
}

export function formatTimer(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (!Number.isFinite(ms)) return 'DNF';
  const centiseconds = Math.floor(Math.max(0, ms) / 10);
  const seconds = Math.floor(centiseconds / 100);
  return `${seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : seconds}.${String(centiseconds % 100).padStart(2, '0')}`;
}
export function readTimerSolves(raw: string | null): TimerSolve[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((s): s is TimerSolve => !!s && typeof s.id === 'string' && typeof s.scramble === 'string' &&
      typeof s.startedAt === 'string' && Number.isFinite(s.elapsedMs) && s.elapsedMs >= 0 && ['none', '+2', 'DNF'].includes(s.penalty));
  } catch { return []; }
}
