import { SmartCubeAttemptProducer, type SmartCubeAttemptDevice } from './smart-cube-attempt';
import type { Solve } from './types';
import type { SolveResult } from './machine';
import { NET_EVENTS, type NetPenalty, type NetResult } from './net-battle';
import { decodeTimerSolve } from './persistence';
import type { Quat } from '../smart_cube/orientation';

export interface NetAttemptIdentity { code: string; playerId: string; round: number }
export interface NetAttemptContext extends NetAttemptIdentity {
  sessionId: string;
  id: string;
  ts: number;
  event: Solve['event'];
  scramble: string;
}
export function netAttemptSolveId(identity: NetAttemptIdentity): string {
  return `net-${identity.code}-${identity.playerId}-${identity.round}`;
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
    const record: NetRecordedAttempt = {
      context,
      solve: { id: context.id, ts: context.ts, event: context.event, scramble: context.scramble,
        timeMs: result.timeMs, penalty: result.autoPenalty,
        ...(result.inspectionMs > 0 ? { inspectionMs: Math.round(result.inspectionMs) } : {}), ...fields },
    };
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
  message: { en: 'Online results are waiting to be saved or uploaded.', zh: '有联机成绩等待保存或上传。' },
  volatile: { en: 'Pending results could not be stored. Keep this app open and retry.', zh: '待处理成绩尚未写入存储，请勿关闭应用，请重试。' },
  blocked: { en: 'Pending result recovery is unavailable. Please retry.', zh: '待处理成绩暂时无法恢复，请重试。' },
  rejected: { en: 'Some results could not be accepted by the room. They are saved on this device.', zh: '部分成绩未被房间接受，已保存在本机。' },
  acknowledge: { en: 'Keep local results', zh: '保留本机成绩' },
  retry: { en: 'Retry', zh: '重试' },
};
export interface NetOutboxEntry {
  version: 1;
  revision: string;
  record: NetRecordedAttempt;
  localSaved: boolean;
  upload: 'none' | 'pending' | 'rejected' | 'uploaded';
}
export interface NetOutboxStorage {
  load(): Promise<unknown[]>;
  put(entry: NetOutboxEntry): Promise<NetOutboxEntry>;
  update(entry: NetOutboxEntry): Promise<void>;
  remove(id: string, revision: string): Promise<void>;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}
export function decodeNetOutboxEntry(value: unknown): NetOutboxEntry | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as NetOutboxEntry, c = e.record?.context, s = e.record?.solve;
  if (e.version !== 1 || typeof e.revision !== 'string' || !c || !s
    || !NET_EVENTS.includes(c.event as typeof NET_EVENTS[number])
    || !/^\d{4}$/.test(c.code) || typeof c.playerId !== 'string' || !c.playerId
    || !Number.isSafeInteger(c.round) || c.round < 1 || typeof c.sessionId !== 'string' || !c.sessionId
    || typeof e.localSaved !== 'boolean' || !['none', 'pending', 'rejected', 'uploaded'].includes(e.upload)) return null;
  const solve = decodeTimerSolve(s, c.event);
  if (!solve || c.id !== solve.id || c.ts !== solve.ts || c.scramble !== solve.scramble) return null;
  // Rebuild the context explicitly: credentials must never enter the journal.
  return { version: 1, revision: e.revision, localSaved: e.localSaved, upload: e.upload,
    record: { context: { code: c.code, playerId: c.playerId, round: c.round, sessionId: c.sessionId,
      id: c.id, ts: c.ts, event: c.event, scramble: c.scramble }, solve } };
}
export type NetOutboxUploader = (record: NetRecordedAttempt) => Promise<'uploaded' | 'waiting' | 'rejected'>;

/** Write ahead of delivery; each durable version is independently acknowledged.
 * Hosts inject storage/transport, never a second queue or a persisted capability. */
export class NetRecordingOutbox {
  private readonly records = new Map<string, NetOutboxEntry>();
  private lastCompleted: NetRecordedAttempt | null = null;
  result(identity: NetAttemptIdentity): NetResult | undefined {
    const record = this.records.get(netAttemptSolveId(identity))?.record ?? this.lastCompleted;
    if (!record || record.context.code !== identity.code || record.context.playerId !== identity.playerId
      || record.context.round !== identity.round || record.solve.timeMs === null) return undefined;
    return { t: record.solve.timeMs, p: record.solve.penalty === 'DNF' || record.solve.penalty === 'DNS' ? 'dnf' : record.solve.penalty };
  }
  private readonly dirty = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private uploader: NetOutboxUploader | undefined;
  private snapshot = { pending: 0, busy: false, volatile: false, blocked: false, rejected: 0, saved: 0 };
  constructor(private readonly save: (record: NetRecordedAttempt) => void | Promise<unknown>, private readonly storage?: NetOutboxStorage) {}
  setUploader(uploader: NetOutboxUploader): void { this.uploader = uploader; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(busy: boolean, volatile = this.snapshot.volatile, blocked = this.snapshot.blocked): void {
    this.snapshot = { pending: this.records.size, busy, volatile, blocked, saved: this.snapshot.saved,
      rejected: [...this.records.values()].filter(e => e.localSaved && e.upload === 'rejected').length };
    for (const listener of this.listeners) listener();
  }
  enqueue(record: NetRecordedAttempt, upload = false): Promise<void> {
    const entry: NetOutboxEntry = { version: 1, revision: globalThis.crypto.randomUUID(), record,
      localSaved: false, upload: upload ? 'pending' : 'none' };
    const previous = this.records.get(record.solve.id);
    if (previous) entry.record = { ...previous.record, solve: { ...previous.record.solve, penalty: record.solve.penalty } };
    this.lastCompleted = entry.record;
    this.records.set(record.solve.id, entry);
    this.dirty.add(record.solve.id);
    this.publish(Boolean(this.running), true);
    const durable = this.writing.then(async () => {
      const stored = this.storage ? await this.storage.put(entry) : entry;
      // The journal may recover the original scramble/moves/session from an earlier process.
      if (this.records.get(record.solve.id) === entry) {
        entry.record = stored.record;
        this.dirty.delete(record.solve.id);
      }
      this.publish(Boolean(this.running), this.dirty.size > 0);
    });
    this.writing = durable.catch(() => { this.publish(Boolean(this.running), true); });
    return this.writing.then(() => this.retry());
  }

  private async flush(): Promise<void> {
    await this.writing;
    for (const id of [...this.dirty]) {
      const entry = this.records.get(id)!;
      const stored = this.storage ? await this.storage.put(entry) : entry;
      if (this.records.get(id) === entry) { entry.record = stored.record; this.dirty.delete(id); }
    }
    // Merge by ID, never replace another window's pending records with a stale array.
    if (this.storage) {
      const loaded = await this.storage.load();
      const restored = loaded.map(decodeNetOutboxEntry);
      if (restored.some(e => !e)) throw new Error('Invalid pending online results');
      for (const [id] of this.records) if (!this.dirty.has(id)) this.records.delete(id);
      for (const e of restored) if (e && !this.dirty.has(e.record.solve.id)) this.records.set(e.record.solve.id, e);
    }
    const attempted = new Set<NetOutboxEntry>();
    for (;;) {
      const entry = [...this.records.values()].find(e => !attempted.has(e));
      if (!entry) break;
      attempted.add(entry);
      const id = entry.record.solve.id;
      // No network write before the complete attempt and latest penalty reach durable storage.
      await this.writing;
      if (this.dirty.has(id)) throw new Error('Pending result journal failed');
      if (this.records.get(id) !== entry) continue;
      this.lastCompleted = entry.record;
      this.publish(true);
      this.dirty.delete(id);
      if (!entry.localSaved) {
        try { await this.save(entry.record); entry.localSaved = true; this.snapshot = { ...this.snapshot, saved: this.snapshot.saved + 1 }; await this.storage?.update(entry); }
        catch { /* Local and room delivery are independent; the full journal remains. */ }
      }
      if (this.records.get(id) !== entry) continue;
      if (entry.upload === 'pending' && this.uploader) {
        try {
          const outcome = await this.uploader(entry.record);
          if (this.records.get(id) !== entry) continue;
          if (outcome !== 'waiting') { entry.upload = outcome; await this.storage?.update(entry); }
        } catch { /* Network failure keeps the durable pending version. */ }
      }
      if (this.records.get(id) !== entry) continue;
      if (entry.localSaved && (entry.upload === 'none' || entry.upload === 'uploaded')) {
        await this.storage?.remove(id, entry.revision);
        if (this.records.get(id) === entry) this.records.delete(id);
      }
    }
  }
  retry = (): Promise<void> => {
    if (this.running) return this.running;
    this.publish(true);
    const work = () => this.flush();
    this.running = Promise.resolve().then(() => this.storage ? this.storage.exclusive(work) : work())
      .then(() => this.publish(true, this.dirty.size > 0, false)).catch(() => this.publish(true, this.dirty.size > 0, true))
      .finally(() => { this.running = null; this.publish(false); });
    return this.running;
  };
  acknowledgeRejected = async (): Promise<void> => {
    await this.retry();
    const work = async () => {
      for (const [id, entry] of this.records) if (entry.localSaved && entry.upload === 'rejected') {
        await this.storage?.remove(id, entry.revision);
        if (this.records.get(id) === entry) this.records.delete(id);
      }
    };
    try { if (this.storage) await this.storage.exclusive(work); else await work(); }
    catch { this.publish(false, true); }
    this.publish(false);
  };
}
