import { EVENTS, type EventId, type Penalty, type Solve } from './types';
import {
  DEFAULT_SCRAMBLE_222_MODE,
  DEFAULT_SCRAMBLE_222_TYPE,
  isScramble222Mode,
  isScramble222Type,
  type Scramble222Mode,
  type Scramble222Type,
} from './scramble-222';
import {
  DEFAULT_TIMER_BY_STEPS_SETTINGS,
  type TimerByStepsSettings,
} from './by-steps';
import {
  DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
  isTimerIsoDate,
  normalizeTimerWcaSourceSettings,
  type TimerWcaSourceSettings,
} from './wca-source-config';
import {
  DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION,
  DEFAULT_TIMER_TIMING_SETTINGS,
  normalizeTimerScrambleClickAction,
  normalizeTimerTimingSettings,
  type TimerScrambleClickAction,
  type TimerTimingSettings,
} from './settings-contract';
import {
  DEFAULT_ROLLING_STAT_COLUMNS,
  normalizeRollingStatColumns,
  parseRollingStatKey,
  type RollingStatKey,
} from './rolling-stats';

export const TIMER_DATABASE_VERSION = 3;
export const TIMER_STORE_SCHEMA_VERSION = 2;
export const MAX_TIMER_BACKUP_BYTES = 10 * 1024 * 1024;

const MAX_DATE_MS = 8_640_000_000_000_000;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const EVENT_IDS = new Set<string>(EVENTS.map((event) => event.id));
const PENALTIES = new Set<Penalty>(['ok', '+2', 'DNF', 'DNS']);

export interface TimerSessionMeta {
  id: string;
  name: string;
  createdTs: number;
  /** Event selected for this session. Optional for pre-association backups. */
  event?: EventId;
}

export interface TimerStoreSettings extends
  TimerWcaSourceSettings,
  TimerByStepsSettings,
  TimerTimingSettings {
  event: EventId;
  /** Shared 2x2 full-state generation style; also selects WCA original vs optimal-equivalent rows. */
  scramble222Mode: Scramble222Mode;
  /** Shared 2x2 specialist state family. A real-WCA source treats 3-gen as full state. */
  scramble222Type: Scramble222Type;
  /**
   * Raw persisted text for the manual scramble source. Each non-empty line is
   * one scramble; the source selector itself is intentionally visit-local and
   * resets to real WCA scrambles on a fresh website/App launch.
   */
  manualScrambles: string;
  /** The two compact current/best statistic columns shared with the website. */
  statsRollingColumns: RollingStatKey[];
  scrambleClickAction: TimerScrambleClickAction;
  language: 'en' | 'zh';
  theme: 'system' | 'light' | 'dark';
}

export type TimerSolvesByEvent = Partial<Record<EventId, Solve[]>>;

/** Canonical website/App solve database. Storage drivers own only their envelope. */
export interface TimerDatabase {
  version: typeof TIMER_DATABASE_VERSION;
  sessions: TimerSessionMeta[];
  activeSessionId: string;
  dataBySession: Record<string, TimerSolvesByEvent>;
}

/** Mobile envelope. App-only preferences intentionally do not enter the solve database. */
export interface TimerStoreData {
  schemaVersion: typeof TIMER_STORE_SCHEMA_VERSION;
  database: TimerDatabase;
  settings: TimerStoreSettings;
}

export interface TimerDatabaseEnvironment {
  nowMs: number;
  sessionId: string;
  language?: 'en' | 'zh';
}

export interface TimerBackupSummary {
  sessionCount: number;
  solveCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidDateMs(value: unknown): value is number {
  return isFiniteNonNegative(value) && value <= MAX_DATE_MS;
}

function isSafeKey(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && !DANGEROUS_KEYS.has(value);
}

function isEventId(value: unknown): value is EventId {
  return typeof value === 'string' && EVENT_IDS.has(value);
}

function isPenalty(value: unknown): value is Penalty {
  return typeof value === 'string' && PENALTIES.has(value as Penalty);
}

function decodeNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return isFiniteNonNegative(value) ? value : undefined;
}

function decodeNullableInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function decodeNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function decodeStageSegments(value: unknown): Solve['stageSegments'] | null {
  if (!isRecord(value)) return null;
  const requiredNumbers = ['crossDoneMs', 'f2lDoneMs', 'ollDoneMs', 'solvedMs', 'crossMs', 'f2lMs', 'ollMs', 'pllMs'] as const;
  const requiredIntegers = ['crossHtm', 'f2lHtm', 'ollHtm', 'pllHtm'] as const;
  const optionalIntegers = ['crossEndIdx', 'f2lEndIdx', 'ollEndIdx', 'solvedEndIdx'] as const;
  const requiredStrings = ['crossSide', 'ollCase', 'pllCase'] as const;
  const decoded: Record<string, unknown> = {};

  for (const key of requiredNumbers) {
    const item = decodeNullableNumber(value[key]);
    if (item === undefined) return null;
    decoded[key] = item;
  }
  for (const key of requiredIntegers) {
    const item = decodeNullableInteger(value[key]);
    if (item === undefined) return null;
    decoded[key] = item;
  }
  for (const key of optionalIntegers) {
    if (value[key] === undefined) continue;
    const item = decodeNullableInteger(value[key]);
    if (item === undefined) return null;
    decoded[key] = item;
  }
  for (const key of requiredStrings) {
    const item = decodeNullableString(value[key]);
    if (item === undefined) return null;
    decoded[key] = item;
  }
  return decoded as unknown as NonNullable<Solve['stageSegments']>;
}

export function decodeTimerSolve(value: unknown, event: EventId): Solve | null {
  if (!isRecord(value)) return null;
  if (!isSafeKey(value.id)) return null;
  if (!isFiniteNonNegative(value.timeMs) || !isValidDateMs(value.ts)) return null;
  if (!isPenalty(value.penalty) || typeof value.scramble !== 'string') return null;
  if (value.event !== event) return null;

  const decoded: Solve = {
    id: value.id,
    timeMs: value.timeMs,
    penalty: value.penalty,
    scramble: value.scramble,
    event,
    ts: value.ts,
  };

  if (value.comment !== undefined) {
    if (typeof value.comment !== 'string') return null;
    decoded.comment = value.comment;
  }
  if (value.stages !== undefined) {
    if (!isRecord(value.stages)
      || (value.stages.cross !== undefined && !isFiniteNonNegative(value.stages.cross))
      || (value.stages.f2l !== undefined && !isFiniteNonNegative(value.stages.f2l))
      || (value.stages.oll !== undefined && !isFiniteNonNegative(value.stages.oll))
      || !isFiniteNonNegative(value.stages.pll)) return null;
    decoded.stages = {
      ...(value.stages.cross === undefined ? {} : { cross: value.stages.cross }),
      ...(value.stages.f2l === undefined ? {} : { f2l: value.stages.f2l }),
      ...(value.stages.oll === undefined ? {} : { oll: value.stages.oll }),
      pll: value.stages.pll,
    };
  }
  if (value.bld !== undefined) {
    if (!isRecord(value.bld) || !isFiniteNonNegative(value.bld.memoMs) || value.bld.memoMs > value.timeMs) return null;
    decoded.bld = { memoMs: value.bld.memoMs };
  }
  if (value.mbld !== undefined) {
    if (!isRecord(value.mbld)) return null;
    const solved = value.mbld.solved;
    const attempted = value.mbld.attempted;
    if (typeof solved !== 'number'
      || typeof attempted !== 'number'
      || !Number.isSafeInteger(solved)
      || !Number.isSafeInteger(attempted)
      || solved < 0
      || attempted < 1
      || solved > attempted) return null;
    decoded.mbld = { solved, attempted };
  }
  if (value.caseId !== undefined) {
    if (typeof value.caseId !== 'string') return null;
    decoded.caseId = value.caseId;
  }
  if (value.scrambleSource !== undefined) {
    if (!isRecord(value.scrambleSource)
      || (value.scrambleSource.kind !== 'wca'
        && value.scrambleSource.kind !== 'random'
        && value.scrambleSource.kind !== 'manual')
      || typeof value.scrambleSource.identity !== 'string'
      || value.scrambleSource.identity.length === 0
      || value.scrambleSource.identity.length > 1024) return null;
    decoded.scrambleSource = {
      kind: value.scrambleSource.kind,
      identity: value.scrambleSource.identity,
    };
  }
  if (value.moves !== undefined) {
    if (!Array.isArray(value.moves)) return null;
    const moves: NonNullable<Solve['moves']> = [];
    for (const move of value.moves) {
      if (!isRecord(move) || typeof move.m !== 'string' || move.m.length === 0 || !isFiniteNonNegative(move.ts)) return null;
      moves.push({ m: move.m, ts: move.ts });
    }
    decoded.moves = moves;
  }
  if (value.inspectionMs !== undefined) {
    if (!isFiniteNonNegative(value.inspectionMs)) return null;
    decoded.inspectionMs = value.inspectionMs;
  }
  if (value.device !== undefined) {
    if (!isRecord(value.device) || typeof value.device.model !== 'string' || typeof value.device.name !== 'string') return null;
    decoded.device = { model: value.device.model, name: value.device.name };
  }
  if (value.stageSegments !== undefined) {
    const stageSegments = decodeStageSegments(value.stageSegments);
    if (!stageSegments) return null;
    decoded.stageSegments = stageSegments;
  }
  if (value.gyro !== undefined) {
    if (typeof value.gyro !== 'string') return null;
    decoded.gyro = value.gyro;
  }
  if (value.reconstruction !== undefined) {
    if (!Array.isArray(value.reconstruction) || !value.reconstruction.every((line) => typeof line === 'string')) return null;
    decoded.reconstruction = [...value.reconstruction];
  }
  if (value.reconOk !== undefined) {
    if (typeof value.reconOk !== 'boolean') return null;
    decoded.reconOk = value.reconOk;
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === 'string')) return null;
    decoded.tags = [...value.tags];
  }
  return decoded;
}

function decodeSession(value: unknown): TimerSessionMeta | null {
  if (!isRecord(value) || !isSafeKey(value.id)) return null;
  if (typeof value.name !== 'string' || value.name.length === 0 || !isValidDateMs(value.createdTs)) return null;
  if (value.event !== undefined && !isEventId(value.event)) return null;
  return {
    id: value.id,
    name: value.name,
    createdTs: value.createdTs,
    ...(value.event === undefined ? {} : { event: value.event }),
  };
}

function decodeSettings(value: unknown): TimerStoreSettings | null {
  if (!isRecord(value) || !isEventId(value.event)) return null;
  if (!isFiniteNonNegative(value.inspectionSec) || value.inspectionSec > 60) return null;
  if (!isFiniteNonNegative(value.holdMs) || value.holdMs > 5000) return null;
  // Early v2 Mobile envelopes predate the remaining Web timing fields. A
  // missing field migrates to the shared Web default; a present malformed
  // value remains corrupt so restore/import can never silently change intent.
  for (const key of [
    'timingEnabled',
    'autoSessionForEvent',
    'autoEventForSession',
    'hideTime',
  ] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') return null;
  }
  if (value.runningPrecision !== undefined
    && value.runningPrecision !== 0
    && value.runningPrecision !== 1
    && value.runningPrecision !== 2
    && value.runningPrecision !== 3) return null;
  if (value.precision !== undefined
    && value.precision !== 2
    && value.precision !== 3) return null;
  if (value.scrambleClickAction !== undefined
    && normalizeTimerScrambleClickAction(value.scrambleClickAction) !== value.scrambleClickAction) return null;
  // Store v1 and early v2 envelopes predate manual input. Missing means the
  // canonical empty queue; a present non-string value is corrupt, not data we
  // should silently discard.
  if (value.manualScrambles !== undefined && typeof value.manualScrambles !== 'string') return null;
  // Early Mobile envelopes predate the shared rolling-stat column picker.
  // Missing values migrate to the website default; malformed explicit values
  // remain corrupt instead of silently changing the user's saved choice.
  if (value.statsRollingColumns !== undefined
    && (!Array.isArray(value.statsRollingColumns)
      || !value.statsRollingColumns.every((column) => parseRollingStatKey(column) !== null))) return null;
  // Early v2 envelopes predate the shared 2x2 controls. Missing values migrate
  // to the website's canonical defaults; present invalid values remain corrupt.
  if (value.scramble222Mode !== undefined && !isScramble222Mode(value.scramble222Mode)) return null;
  if (value.scramble222Type !== undefined && !isScramble222Type(value.scramble222Type)) return null;
  // Early v2 envelopes predate shared by-steps settings. Missing fields migrate
  // to canonical defaults; present malformed fields make the backup corrupt.
  if (value.genByStepsOn !== undefined && typeof value.genByStepsOn !== 'boolean') return null;
  if (value.genStepsMetric !== undefined
    && (typeof value.genStepsMetric !== 'string' || value.genStepsMetric.length > 32)) return null;
  if (value.genSteps !== undefined
    && (!Array.isArray(value.genSteps)
      || !value.genSteps.every((step) => Number.isSafeInteger(step) && step >= 0 && step <= 100))) return null;
  if (value.wcaScrambleMode !== undefined
    && value.wcaScrambleMode !== 'comp'
    && value.wcaScrambleMode !== 'date') return null;
  for (const key of [
    'wcaComp',
    'wcaCompName',
    'wcaCompCountry',
    'wcaRound',
    'wcaGroup',
    'wcaDateFrom',
    'wcaDateTo',
  ] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return null;
  }
  if (typeof value.wcaDateFrom === 'string'
    && value.wcaDateFrom !== ''
    && !isTimerIsoDate(value.wcaDateFrom)) return null;
  if (typeof value.wcaDateTo === 'string'
    && value.wcaDateTo !== ''
    && !isTimerIsoDate(value.wcaDateTo)) return null;
  for (const key of ['wcaUseOptimal', 'wcaDifficultyOn', 'wcaDiffMerged'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') return null;
  }
  for (const key of ['wcaDiffVariant', 'wcaDiffStage', 'wcaDiffColors'] as const) {
    if (value[key] !== undefined
      && (typeof value[key] !== 'string' || value[key].length > 64)) return null;
  }
  if (value.wcaDiffSteps !== undefined
    && (!Array.isArray(value.wcaDiffSteps)
      || !value.wcaDiffSteps.every((step) => (
        Number.isSafeInteger(step) && step >= 0 && step <= 500
      )))) return null;
  if (value.language !== 'en' && value.language !== 'zh') return null;
  if (value.theme !== 'system' && value.theme !== 'light' && value.theme !== 'dark') return null;
  const wcaSource = normalizeTimerWcaSourceSettings({
    wcaScrambleMode: value.wcaScrambleMode as TimerWcaSourceSettings['wcaScrambleMode'] | undefined,
    wcaComp: value.wcaComp as string | undefined,
    wcaCompName: value.wcaCompName as string | undefined,
    wcaCompCountry: value.wcaCompCountry as string | undefined,
    wcaRound: value.wcaRound as string | undefined,
    wcaGroup: value.wcaGroup as string | undefined,
    wcaDateFrom: value.wcaDateFrom as string | undefined,
    wcaDateTo: value.wcaDateTo as string | undefined,
    wcaUseOptimal: value.wcaUseOptimal as boolean | undefined,
    wcaDifficultyOn: value.wcaDifficultyOn as boolean | undefined,
    wcaDiffVariant: value.wcaDiffVariant as string | undefined,
    wcaDiffStage: value.wcaDiffStage as string | undefined,
    wcaDiffColors: value.wcaDiffColors as string | undefined,
    wcaDiffSteps: value.wcaDiffSteps as number[] | undefined,
    wcaDiffMerged: value.wcaDiffMerged as boolean | undefined,
  });
  const timing = normalizeTimerTimingSettings({
    timingEnabled: value.timingEnabled,
    inspectionSec: value.inspectionSec,
    holdMs: value.holdMs,
    autoSessionForEvent: value.autoSessionForEvent,
    autoEventForSession: value.autoEventForSession,
    hideTime: value.hideTime,
    runningPrecision: value.runningPrecision,
    precision: value.precision,
  });
  return {
    event: value.event,
    // Early Mobile builds offered a wider timing range than Web. Normalize at
    // the shared migration boundary: 300 remains a valid user choice, while
    // legacy 0/out-of-Web-range values gain the canonical Web meaning.
    ...timing,
    scramble222Mode: value.scramble222Mode ?? DEFAULT_SCRAMBLE_222_MODE,
    scramble222Type: value.scramble222Type ?? DEFAULT_SCRAMBLE_222_TYPE,
    genByStepsOn: value.genByStepsOn ?? DEFAULT_TIMER_BY_STEPS_SETTINGS.genByStepsOn,
    genStepsMetric: value.genStepsMetric ?? DEFAULT_TIMER_BY_STEPS_SETTINGS.genStepsMetric,
    genSteps: value.genSteps === undefined
      ? [...DEFAULT_TIMER_BY_STEPS_SETTINGS.genSteps]
      : [...value.genSteps] as number[],
    manualScrambles: value.manualScrambles ?? '',
    statsRollingColumns: value.statsRollingColumns === undefined
      ? [...DEFAULT_ROLLING_STAT_COLUMNS]
      : normalizeRollingStatColumns(value.statsRollingColumns),
    scrambleClickAction: normalizeTimerScrambleClickAction(value.scrambleClickAction),
    ...wcaSource,
    language: value.language,
    theme: value.theme,
  };
}

function decodeByEvent(value: unknown): TimerSolvesByEvent | null {
  if (!isRecord(value)) return null;
  const decoded: TimerSolvesByEvent = {};
  for (const [rawEvent, rawSolves] of Object.entries(value)) {
    if (!isEventId(rawEvent) || !Array.isArray(rawSolves)) return null;
    const solves: Solve[] = [];
    const ids = new Set<string>();
    for (const rawSolve of rawSolves) {
      const solve = decodeTimerSolve(rawSolve, rawEvent);
      if (!solve || ids.has(solve.id)) return null;
      ids.add(solve.id);
      solves.push(solve);
    }
    decoded[rawEvent] = solves.sort((a, b) => a.ts - b.ts);
  }
  return decoded;
}

function safeEnvironment(environment: TimerDatabaseEnvironment): Required<TimerDatabaseEnvironment> {
  return {
    nowMs: isValidDateMs(environment.nowMs) ? environment.nowMs : 0,
    sessionId: isSafeKey(environment.sessionId) ? environment.sessionId : 'default',
    language: environment.language === 'zh' ? 'zh' : 'en',
  };
}

function decodeCurrentDatabase(value: unknown): TimerDatabase | null {
  if (!isRecord(value) || value.version !== TIMER_DATABASE_VERSION) return null;
  if (!Array.isArray(value.sessions) || value.sessions.length === 0) return null;
  const sessions: TimerSessionMeta[] = [];
  for (const rawSession of value.sessions) {
    const session = decodeSession(rawSession);
    if (!session) return null;
    sessions.push(session);
  }
  if (new Set(sessions.map((session) => session.id)).size !== sessions.length) return null;
  if (!isSafeKey(value.activeSessionId) || !sessions.some((session) => session.id === value.activeSessionId)) return null;
  if (!isRecord(value.dataBySession)) return null;

  const sessionIds = new Set(sessions.map((session) => session.id));
  if (Object.keys(value.dataBySession).some((id) => !sessionIds.has(id))) return null;
  const dataBySession = Object.create(null) as Record<string, TimerSolvesByEvent>;
  for (const session of sessions) {
    if (!Object.prototype.hasOwnProperty.call(value.dataBySession, session.id)) return null;
    const decoded = decodeByEvent(value.dataBySession[session.id]);
    if (!decoded) return null;
    dataBySession[session.id] = decoded;
  }
  return {
    version: TIMER_DATABASE_VERSION,
    sessions,
    activeSessionId: value.activeSessionId,
    dataBySession,
  };
}

function wrapByEventAsDatabase(byEvent: TimerSolvesByEvent, environment: TimerDatabaseEnvironment): TimerDatabase {
  const safe = safeEnvironment(environment);
  const dataBySession = Object.create(null) as Record<string, TimerSolvesByEvent>;
  dataBySession[safe.sessionId] = byEvent;
  return {
    version: TIMER_DATABASE_VERSION,
    sessions: [{
      id: safe.sessionId,
      name: safe.language === 'zh' ? '默认' : 'Default',
      createdTs: safe.nowMs,
    }],
    activeSessionId: safe.sessionId,
    dataBySession,
  };
}

export function createTimerDatabase(
  nowMs: number,
  sessionId: string,
  language: 'en' | 'zh' = 'en',
): TimerDatabase {
  return wrapByEventAsDatabase({}, { nowMs, sessionId, language });
}

/**
 * Single decoder/migration chain used by website and App. It accepts website
 * v1/v2/v3 backups plus the App envelope and always returns canonical v3.
 */
export function decodeTimerDatabase(
  value: unknown,
  environment: TimerDatabaseEnvironment,
): TimerDatabase | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion === TIMER_STORE_SCHEMA_VERSION) {
    return decodeTimerDatabase(value.database, environment);
  }
  if (value.schemaVersion === 1) {
    // Store schema v1 predated the nested database envelope. Its database was
    // explicitly v3; keep that version frozen so a future DB migration cannot
    // accidentally reinterpret it as whatever the newest version is.
    return decodeTimerDatabase({
      version: 3,
      sessions: value.sessions,
      activeSessionId: value.activeSessionId,
      dataBySession: value.dataBySession,
    }, environment);
  }
  const current = decodeCurrentDatabase(value);
  if (current) return current;
  if (value.version === 2) {
    const byEvent = decodeByEvent(value.byEvent);
    return byEvent ? wrapByEventAsDatabase(byEvent, environment) : null;
  }
  if (value.version === 1 && Array.isArray(value.sessions)) {
    const merged: TimerSolvesByEvent = {};
    const idsByEvent = new Map<EventId, Set<string>>();
    for (const rawSession of value.sessions) {
      if (!isRecord(rawSession) || !isEventId(rawSession.event) || !Array.isArray(rawSession.solves)) return null;
      const target = merged[rawSession.event] ?? [];
      const ids = idsByEvent.get(rawSession.event) ?? new Set<string>();
      for (const rawSolve of rawSession.solves) {
        const solve = decodeTimerSolve(rawSolve, rawSession.event);
        if (!solve || ids.has(solve.id)) return null;
        ids.add(solve.id);
        target.push(solve);
      }
      merged[rawSession.event] = target.sort((a, b) => a.ts - b.ts);
      idsByEvent.set(rawSession.event, ids);
    }
    return wrapByEventAsDatabase(merged, environment);
  }
  return null;
}

export function createTimerStoreData(
  nowMs: number,
  sessionId: string,
  language: 'en' | 'zh' = 'en',
): TimerStoreData {
  const database = createTimerDatabase(nowMs, sessionId, language);
  return {
    schemaVersion: TIMER_STORE_SCHEMA_VERSION,
    database,
    settings: {
      event: '333',
      ...DEFAULT_TIMER_TIMING_SETTINGS,
      scramble222Mode: DEFAULT_SCRAMBLE_222_MODE,
      scramble222Type: DEFAULT_SCRAMBLE_222_TYPE,
      ...DEFAULT_TIMER_BY_STEPS_SETTINGS,
      manualScrambles: '',
      statsRollingColumns: [...DEFAULT_ROLLING_STAT_COLUMNS],
      scrambleClickAction: DEFAULT_TIMER_SCRAMBLE_CLICK_ACTION,
      ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
      language,
      theme: 'system',
    },
  };
}

/** Deeply validates every persisted field and returns a sanitized clone. */
export function decodeTimerStoreData(value: unknown): TimerStoreData | null {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== TIMER_STORE_SCHEMA_VERSION)) return null;
  const database = decodeTimerDatabase(value, { nowMs: 0, sessionId: 'default' });
  const settings = decodeSettings(value.settings);
  if (!database || !settings) return null;
  return {
    schemaVersion: TIMER_STORE_SCHEMA_VERSION,
    database,
    settings,
  };
}

export function parseTimerDatabaseJson(
  text: string,
  environment: TimerDatabaseEnvironment,
): TimerDatabase | null {
  try {
    return decodeTimerDatabase(JSON.parse(text) as unknown, environment);
  } catch {
    return null;
  }
}

/** App imports also accept website backups; existing App preferences are preserved. */
export function parseTimerStoreJson(
  text: string,
  fallbackSettings?: TimerStoreSettings,
  environment: TimerDatabaseEnvironment = { nowMs: 0, sessionId: 'default' },
): TimerStoreData | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    const mobile = decodeTimerStoreData(parsed);
    if (mobile) return mobile;
    const database = decodeTimerDatabase(parsed, environment);
    const settings = fallbackSettings ? decodeSettings(fallbackSettings) : null;
    if (!database || !settings) return null;
    return {
      schemaVersion: TIMER_STORE_SCHEMA_VERSION,
      database,
      settings,
    };
  } catch {
    return null;
  }
}

export function serializeTimerStoreData(data: TimerStoreData): string {
  const decoded = decodeTimerStoreData(data);
  if (!decoded) throw new Error('Cannot serialize invalid timer data');
  return `${JSON.stringify(decoded, null, 2)}\n`;
}

export function summarizeTimerDatabase(data: Pick<TimerDatabase, 'sessions' | 'dataBySession'>): TimerBackupSummary {
  let solveCount = 0;
  for (const session of data.sessions) {
    const byEvent = data.dataBySession[session.id] ?? {};
    for (const solves of Object.values(byEvent)) solveCount += solves?.length ?? 0;
  }
  return { sessionCount: data.sessions.length, solveCount };
}

export function activeTimerSolves(data: TimerStoreData, event: EventId): Solve[] {
  return data.database.dataBySession[data.database.activeSessionId]?.[event] ?? [];
}
