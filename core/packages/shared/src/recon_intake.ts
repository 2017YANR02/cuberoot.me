import type { Solve } from './timer/types';
import type { ReconTextResult } from './timer/reconstruct/recon_text';

/** Stored separately from any user-supplied reconstruction override. */
export interface ReconRecording {
  scramble: string;
  moves: Array<{ m: string; ts: number }>;
  timeMs: number;
  model: string;
  gyro?: string;
}
export interface ReconSnapshot {
  inspection: string;
  lines: Array<{
    key: string; kind: string; fromIdx: number; toIdx: number;
    moves: string[]; label: string | null;
  }>;
}
export interface ReconAnnotation {
  id: string;
  /** null means the entire recording, never a mutable displayed row number. */
  range: { fromIdx: number; toIdx: number } | null;
  observed: string;
  problem: string;
  expectedAlgorithm: string;
  expectedEffect: string;
}
export interface ReconIntakeInput {
  source: string;
  /** Explicit source reconstruction identity, absent for legacy/manual samples. */
  sourceReconId?: number;
  /** Source scramble and solution fingerprint captured when the test was selected. */
  sourceReconHash?: string;
  recording: ReconRecording;
  observed: ReconSnapshot;
  annotations: ReconAnnotation[];
  verdict: 'correct' | 'needs-fix';
  language: 'en' | 'zh';
  /** What was rendered may contain a manual override; the runner must ignore it. */
  hadOverride: boolean;
}
export type ReconIntakeStatus = 'pending-test' | 'needs-fix' | 'needs-review' | 'active';
export interface ReconIntakeRun {
  id: string; status: 'passed' | 'failed' | 'interrupted';
  actual: ReconSnapshot | null; errors: string[];
  fingerprint: string; libraryHash: string; commit: string;
  regressionPassed: boolean;
}
export interface ReconIntakeCase {
  id: string; revision: number; contentHash: string; recordingHash: string;
  sourceSnapshot?: { id: number; scramble: string; solution: string } | null;
  input: ReconIntakeInput; expected: ReconSnapshot | null;
  status: ReconIntakeStatus; createdBy: string; createdAt: string; updatedAt: string;
  approvedBy: string | null;
  latestRun: (ReconIntakeRun & { createdAt: string; revision: number }) | null;
  claimedBy: string | null; leaseUntil: string | null;
}
export interface ReconIntakeClaim {
  item: ReconIntakeCase;
  leaseToken: string;
}
/** JSONB may reorder object keys; hashes and comparisons must not depend on it. */
export function reconCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(reconCanonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).filter(key => object[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + reconCanonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export function reconSnapshot(recon: ReconTextResult): ReconSnapshot {
  return {
    inspection: recon.inspection,
    lines: recon.lines.map(({ key, kind, fromIdx, toIdx, moves, label }) =>
      ({ key, kind, fromIdx, toIdx, moves: [...moves], label })),
  };
}
export function reconRecording(solve: Solve): ReconRecording {
  return {
    scramble: solve.scramble,
    moves: (solve.moves ?? []).map(({ m, ts }) => ({ m, ts })),
    timeMs: solve.timeMs, model: solve.device?.model ?? '',
    ...(solve.gyro ? { gyro: solve.gyro } : {}),
  };
}
export function recordingSolve(recording: ReconRecording, id = 'intake'): Solve {
  return { id, event: '333', ts: 0, penalty: 'ok', ...recording,
    device: { model: recording.model, name: '' } };
}
