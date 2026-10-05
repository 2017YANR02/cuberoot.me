import { SmartCubeAttemptProducer, type SmartCubeAttemptDevice } from './smart-cube-attempt';
import type { Solve } from './types';
import type { SolveResult } from './machine';
import type { NetPenalty } from './net-battle';
import type { Quat } from '../smart_cube/orientation';

export interface NetAttemptIdentity { code: string; playerId: string; round: number }
export interface NetAttemptContext extends NetAttemptIdentity {
  sessionId: string;
  id: string;
  ts: number;
  event: Solve['event'];
  scramble: string;
}
export interface NetRecordedAttempt { context: NetAttemptContext; solve: Solve }

/** Freeze room, round and local session at start; polling must never retarget a recording. */
export class NetBattleAttemptRecorder {
  private readonly producer = new SmartCubeAttemptProducer();
  private context: NetAttemptContext | null = null;
  private startedAtMs = 0;
  private latest: NetRecordedAttempt | null = null;
  begin(context: NetAttemptContext, startedAtMs: number, device?: SmartCubeAttemptDevice): void {
    this.context = { ...context };
    this.startedAtMs = startedAtMs;
    this.producer.begin(startedAtMs, device);
  }
  recordMove(move: string, atMs: number): boolean { return this.producer.recordMove(move, atMs); }
  recordGyro(quaternion: Quat, atMs: number): void { this.producer.recordGyro(quaternion, atMs - this.startedAtMs); }
  finish(result: SolveResult): { context: NetAttemptContext; record: NetRecordedAttempt | null } | null {
    const context = this.context;
    this.context = null;
    if (!context) return null;
    const fields = this.producer.finishSolveFields({ ...context, timeMs: result.timeMs });
    const record: NetRecordedAttempt | null = fields.moves?.length && context.scramble ? {
      context,
      solve: { id: context.id, ts: context.ts, event: context.event, scramble: context.scramble,
        timeMs: result.timeMs, penalty: result.autoPenalty,
        ...(result.inspectionMs > 0 ? { inspectionMs: Math.round(result.inspectionMs) } : {}), ...fields },
    } : null;
    this.latest = record;
    return { context, record };
  }
  penalty(identity: NetAttemptIdentity, penalty: NetPenalty): NetRecordedAttempt | null {
    const record = this.latest;
    if (!record || record.context.code !== identity.code || record.context.playerId !== identity.playerId
      || record.context.round !== identity.round) return null;
    this.latest = { ...record, solve: { ...record.solve, penalty: penalty === 'dnf' ? 'DNF' : penalty } };
    return this.latest;
  }
  reset(): void { this.context = null; this.producer.reset(); }
}

/** Repeated delivery is idempotent; penalty changes preserve later comments and feedback. */
export function upsertNetRecordedSolve(solves: readonly Solve[], solve: Solve): Solve[] {
  return solves.some(item => item.id === solve.id)
    ? solves.map(item => item.id === solve.id ? { ...item, penalty: solve.penalty } : item)
    : [...solves, solve].sort((a, b) => a.ts - b.ts);
}

export const NET_RECORDING_SAVE_COPY = {
  message: { en: 'Online results have not yet been saved on this device.', zh: '有联机成绩尚未保存在本机。' },
  retry: { en: 'Retry', zh: '重试' },
};

/** Host-owned outbox survives room changes. Failed writes retain their original identity. */
export class NetRecordingOutbox {
  private readonly records = new Map<string, NetRecordedAttempt>();
  private readonly listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private snapshot = { pending: 0, busy: false };
  constructor(private readonly save: (record: NetRecordedAttempt) => void | Promise<unknown>) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(busy: boolean): void {
    this.snapshot = { pending: this.records.size, busy };
    for (const listener of this.listeners) listener();
  }
  enqueue(record: NetRecordedAttempt): Promise<void> {
    this.records.set(record.solve.id, record);
    return this.retry();
  }
  retry = (): Promise<void> => {
    if (this.running) return this.running;
    this.publish(true);
    this.running = Promise.resolve().then(async () => {
      const attempted = new Set<NetRecordedAttempt>();
      for (;;) {
        const record = [...this.records.values()].find(item => !attempted.has(item));
        if (!record) break;
        attempted.add(record);
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await this.save(record);
            if (this.records.get(record.solve.id) === record) this.records.delete(record.solve.id);
            break;
          } catch { /* Retain for an explicit retry or the next enqueue. */ }
        }
      }
    }).finally(() => { this.running = null; this.publish(false); });
    return this.running;
  };
}
