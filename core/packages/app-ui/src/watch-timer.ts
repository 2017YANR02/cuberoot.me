import type { TimerStoreData } from '@cuberoot/shared/timer';
import { EVENTS, type EventId, type Solve } from '@cuberoot/shared/timer/types';
import { stageSegmentsFor } from '@cuberoot/shared/timer/reconstruct/stage-segments';

/** v1 intentionally supports ordinary random, single-puzzle timed attempts. */
export const WATCH_TIMER_EVENTS: readonly EventId[] = ['222', '333', '444', '555', '666', '777', '333oh', 'clock', 'mega', 'pyra', 'skewb', 'sq1'];
export interface WatchTimerSlot {
  id: string; sessionId: string; sessionName: string; event: EventId; eventName: string;
  scramble: string; inspectionSec: number; holdMs: number;
  previewPng?: string;
}
export interface WatchTimerBatch {
  version: 1; id: string; configuration: string; language: 'en' | 'zh';
  slots: WatchTimerSlot[]; unsupported: boolean;
  /** Assigned durably by the native phone transport before delivery. */
  sourceId?: string; sequence?: number; recordingVersion?: number;
}
export interface WatchTimerRecord {
  version: 1; id: string; slot: WatchTimerSlot; timeMs: number;
  ts: number; penalty: 'ok' | '+2' | 'DNF'; inspectionMs: number;
  reconOk?: boolean; reconRevision?: number;
  moves?: Solve['moves']; gyro?: string; device?: Solve['device'];
}
/** The native host owns delivery and durable inbox; the product owns generation/storage. */
export interface WatchTimerPort {
  read(): Promise<{ installed: boolean; records: unknown[]; requestId: string; configuration: string }>;
  publish(batch: WatchTimerBatch, requestId: string): Promise<void>;
  acknowledge(ids: string[], revisions?: Record<string, number>): Promise<void>;
}
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,160}$/.test(v)
  && !['__proto__', 'constructor', 'prototype'].includes(v);
const bounded = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
export function decodeWatchTimerRecord(raw: unknown): WatchTimerRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as WatchTimerRecord, s = r.slot;
  if (r.version !== 1 || !identifier(r.id) || !s || !identifier(s.id) || !identifier(s.sessionId)
    || !WATCH_TIMER_EVENTS.includes(s.event) || typeof s.sessionName !== 'string' || s.sessionName.length > 500
    || typeof s.eventName !== 'string' || s.eventName.length > 100
    || typeof s.scramble !== 'string' || !s.scramble.trim() || s.scramble.length > 8192
    || (s.previewPng !== undefined && (typeof s.previewPng !== 'string' || s.previewPng.length > 900_000))
    || !bounded(s.inspectionSec, 60) || !bounded(s.holdMs, 2000) || s.holdMs < 100
    || !bounded(r.timeMs, 86_400_000) || !bounded(r.inspectionMs, 86_400_000)
    || !bounded(r.ts, 8_640_000_000_000_000) || !['ok', '+2', 'DNF'].includes(r.penalty)) return null;
  if (r.reconRevision !== undefined && (!Number.isSafeInteger(r.reconRevision) || r.reconRevision < 0)) return null;
  if (r.reconOk !== undefined && typeof r.reconOk !== 'boolean') return null;
  if (r.moves !== undefined && (!Array.isArray(r.moves) || r.moves.length > 100_000
    || r.moves.some((move, i) => !move || typeof move.m !== 'string' || !/^[URFDLB](?:2|'|2')?$/.test(move.m)
      || !bounded(move.ts, 86_400_000) || move.ts < (r.moves![i - 1]?.ts ?? 0)))) return null;
  if (r.gyro !== undefined && (typeof r.gyro !== 'string' || r.gyro.length > 32_100)) return null;
  if (r.device !== undefined && (!r.device || !['gan-v1', 'gan-v2', 'gan-v3', 'gan-v4', 'moyu32', 'qiyi'].includes(r.device.model)
    || typeof r.device.name !== 'string' || r.device.name.length > 200)) return null;
  return r;
}
export function watchTimerSolve(record: WatchTimerRecord): Solve {
  const solve: Solve = { id: `watch-${record.id}`, event: record.slot.event, ts: record.ts,
    timeMs: record.timeMs, penalty: record.penalty, scramble: record.slot.scramble,
    inspectionMs: record.inspectionMs,
    scrambleSource: { kind: 'random', identity: JSON.stringify(['watch', 1, record.slot.event, record.slot.id]) } };
  if (record.reconRevision !== undefined) solve.watchReconRevision = record.reconRevision;
  if (record.reconOk !== undefined) solve.reconOk = record.reconOk;
  if (record.moves?.length) {
    solve.moves = record.moves;
    if (record.device) solve.device = record.device;
    if (record.gyro) solve.gyro = record.gyro;
    const segments = stageSegmentsFor(solve);
    if (segments) solve.stageSegments = segments;
  }
  return solve;
}
export function watchTimerConfiguration(data: TimerStoreData): string {
  const { event, inspectionSec, holdMs, language } = data.settings;
  const session = data.database.sessions.find(s => s.id === data.database.activeSessionId)!;
  return JSON.stringify([session.id, session.name, event, inspectionSec, holdMs, language, 'preview-v2-retina-recording-v1']);
}
export function watchTimerSlot(data: TimerStoreData, scramble: string): WatchTimerSlot {
  const { event, inspectionSec, holdMs, language } = data.settings;
  const session = data.database.sessions.find(s => s.id === data.database.activeSessionId)!;
  const eventInfo = EVENTS.find(e => e.id === event)!;
  return { id: crypto.randomUUID(), sessionId: session.id, sessionName: session.name,
    event, eventName: ({ en: eventInfo.nameEn, zh: eventInfo.nameZh })[language], scramble, inspectionSec, holdMs };
}
