import { EVENTS, type EventId, type Penalty, type Solve } from './types';

export const TIMER_STORE_SCHEMA_VERSION = 1;

export interface TimerSessionMeta {
  id: string;
  name: string;
  createdTs: number;
}

export interface TimerStoreSettings {
  event: EventId;
  inspectionSec: number;
  holdMs: number;
  language: 'en' | 'zh';
  theme: 'system' | 'light' | 'dark';
}

export type TimerSolvesByEvent = Partial<Record<EventId, Solve[]>>;

export interface TimerStoreData {
  schemaVersion: typeof TIMER_STORE_SCHEMA_VERSION;
  sessions: TimerSessionMeta[];
  activeSessionId: string;
  dataBySession: Record<string, TimerSolvesByEvent>;
  settings: TimerStoreSettings;
}

const EVENT_IDS = new Set<string>(EVENTS.map((event) => event.id));
const PENALTIES = new Set<Penalty>(['ok', '+2', 'DNF', 'DNS']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isEventId(value: unknown): value is EventId {
  return typeof value === 'string' && EVENT_IDS.has(value);
}

function isPenalty(value: unknown): value is Penalty {
  return typeof value === 'string' && PENALTIES.has(value as Penalty);
}

function isSolve(value: unknown, event: EventId): value is Solve {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isFiniteNonNegative(value.timeMs) || !isFiniteNonNegative(value.ts)) return false;
  if (!isPenalty(value.penalty) || typeof value.scramble !== 'string') return false;
  if (value.event !== event) return false;
  if (value.comment !== undefined && typeof value.comment !== 'string') return false;
  return true;
}

function isSession(value: unknown): value is TimerSessionMeta {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && value.name.length > 0
    && isFiniteNonNegative(value.createdTs);
}

function decodeSettings(value: unknown): TimerStoreSettings | null {
  if (!isRecord(value)) return null;
  if (!isEventId(value.event)) return null;
  if (!isFiniteNonNegative(value.inspectionSec) || value.inspectionSec > 60) return null;
  if (!isFiniteNonNegative(value.holdMs) || value.holdMs > 5000) return null;
  if (value.language !== 'en' && value.language !== 'zh') return null;
  if (value.theme !== 'system' && value.theme !== 'light' && value.theme !== 'dark') return null;
  return {
    event: value.event,
    inspectionSec: value.inspectionSec,
    holdMs: value.holdMs,
    language: value.language,
    theme: value.theme,
  };
}

function decodeByEvent(value: unknown): TimerSolvesByEvent | null {
  if (!isRecord(value)) return null;
  const decoded: TimerSolvesByEvent = {};
  for (const [rawEvent, rawSolves] of Object.entries(value)) {
    if (!isEventId(rawEvent) || !Array.isArray(rawSolves)) return null;
    if (!rawSolves.every((solve) => isSolve(solve, rawEvent))) return null;
    decoded[rawEvent] = [...rawSolves].sort((a, b) => a.ts - b.ts);
  }
  return decoded;
}

/**
 * Creates a valid empty store. Callers inject time/id so tests and migrations
 * remain deterministic.
 */
export function createTimerStoreData(
  nowMs: number,
  sessionId: string,
  language: 'en' | 'zh' = 'en',
): TimerStoreData {
  const safeNow = isFiniteNonNegative(nowMs) ? nowMs : 0;
  const safeId = sessionId.trim() || 'default';
  return {
    schemaVersion: TIMER_STORE_SCHEMA_VERSION,
    sessions: [{ id: safeId, name: language === 'zh' ? '默认' : 'Default', createdTs: safeNow }],
    activeSessionId: safeId,
    dataBySession: { [safeId]: {} },
    settings: {
      event: '333',
      inspectionSec: 0,
      holdMs: 300,
      language,
      theme: 'system',
    },
  };
}

/**
 * Validates the entire persistence boundary. Invalid versions, orphaned active
 * sessions, duplicate ids, unknown events, mismatched solve events, NaN and
 * negative times are rejected instead of being partially imported.
 */
export function decodeTimerStoreData(value: unknown): TimerStoreData | null {
  if (!isRecord(value) || value.schemaVersion !== TIMER_STORE_SCHEMA_VERSION) return null;
  if (!Array.isArray(value.sessions) || value.sessions.length === 0) return null;
  if (!value.sessions.every(isSession)) return null;
  const sessions = value.sessions as TimerSessionMeta[];
  if (new Set(sessions.map((session) => session.id)).size !== sessions.length) return null;
  if (typeof value.activeSessionId !== 'string') return null;
  if (!sessions.some((session) => session.id === value.activeSessionId)) return null;
  if (!isRecord(value.dataBySession)) return null;

  const dataBySession: Record<string, TimerSolvesByEvent> = {};
  for (const session of sessions) {
    const decoded = decodeByEvent(value.dataBySession[session.id]);
    if (!decoded) return null;
    dataBySession[session.id] = decoded;
  }

  const settings = decodeSettings(value.settings);
  if (!settings) return null;
  return {
    schemaVersion: TIMER_STORE_SCHEMA_VERSION,
    sessions: sessions.map((session) => ({ ...session })),
    activeSessionId: value.activeSessionId,
    dataBySession,
    settings,
  };
}

export function parseTimerStoreJson(text: string): TimerStoreData | null {
  try {
    return decodeTimerStoreData(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export function serializeTimerStoreData(data: TimerStoreData): string {
  const decoded = decodeTimerStoreData(data);
  if (!decoded) throw new Error('Cannot serialize invalid timer data');
  return `${JSON.stringify(decoded, null, 2)}\n`;
}

export function activeTimerSolves(data: TimerStoreData, event: EventId): Solve[] {
  return data.dataBySession[data.activeSessionId]?.[event] ?? [];
}
