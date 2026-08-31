import type { TimerDatabase, TimerSessionMeta, TimerSolvesByEvent } from './persistence';
import type { EventId, Solve } from './types';

export type TimerSessionMutationFailure =
  | 'duplicate-session-id'
  | 'empty-name'
  | 'last-session'
  | 'no-matching-session'
  | 'same-session'
  | 'unknown-session'
  | 'unknown-solve';

export interface TimerSessionMutationResult {
  /** A new database when changed, otherwise the exact input reference. */
  database: TimerDatabase;
  changed: boolean;
  failure: TimerSessionMutationFailure | null;
  /** The active id after the operation (also populated for refused operations). */
  activeSessionId: string;
}

export interface TimerSessionSelectionResult extends TimerSessionMutationResult {
  /** The created/activated/matched session, or null when no match was found. */
  sessionId: string | null;
}

export interface TimerSessionSnapshot {
  sessions: TimerSessionMeta[];
  activeSessionId: string;
}

export interface CreateTimerSessionInput {
  id: string;
  name: string;
  createdTs: number;
  event?: EventId;
  /** Runtime adapters choose the localized fallback; the pure rule only trims it. */
  fallbackName: string;
}

function unchanged(
  database: TimerDatabase,
  failure: TimerSessionMutationFailure | null = null,
): TimerSessionMutationResult {
  return {
    database,
    changed: false,
    failure,
    activeSessionId: database.activeSessionId,
  };
}

function selected(
  result: TimerSessionMutationResult,
  sessionId: string | null,
): TimerSessionSelectionResult {
  return { ...result, sessionId };
}

function replaceSession(
  database: TimerDatabase,
  sessionId: string,
  update: (session: TimerSessionMeta) => TimerSessionMeta,
): TimerDatabase {
  return {
    ...database,
    sessions: database.sessions.map((session) => (
      session.id === sessionId ? update(session) : session
    )),
  };
}

/** Defensive copy for controlled UI props; callers cannot mutate persistence state. */
export function timerSessionSnapshot(database: TimerDatabase): TimerSessionSnapshot {
  return {
    sessions: database.sessions.map((session) => ({ ...session })),
    activeSessionId: database.activeSessionId,
  };
}

/** Explicit association, or a safe inference for a legacy single-event session. */
export function timerSessionEvent(database: TimerDatabase, sessionId: string): EventId | null {
  const session = database.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return null;
  if (session.event) return session.event;

  const populated = Object.entries(database.dataBySession[session.id] ?? {})
    .filter(([, solves]) => (solves?.length ?? 0) > 0)
    .map(([event]) => event as EventId);
  return populated.length === 1 ? populated[0] : null;
}

export function activateTimerSession(
  database: TimerDatabase,
  sessionId: string,
): TimerSessionSelectionResult {
  if (!database.sessions.some((session) => session.id === sessionId)) {
    return selected(unchanged(database, 'unknown-session'), null);
  }
  if (database.activeSessionId === sessionId) {
    return selected(unchanged(database), sessionId);
  }
  const next: TimerDatabase = { ...database, activeSessionId: sessionId };
  return selected({
    database: next,
    changed: true,
    failure: null,
    activeSessionId: sessionId,
  }, sessionId);
}

export function createTimerSession(
  database: TimerDatabase,
  input: CreateTimerSessionInput,
): TimerSessionSelectionResult {
  if (database.sessions.some((session) => session.id === input.id)) {
    return selected(unchanged(database, 'duplicate-session-id'), null);
  }
  const name = input.name.trim() || input.fallbackName.trim();
  if (!name) return selected(unchanged(database, 'empty-name'), null);

  const session: TimerSessionMeta = {
    id: input.id,
    name,
    createdTs: input.createdTs,
    ...(input.event ? { event: input.event } : {}),
  };
  const next: TimerDatabase = {
    ...database,
    sessions: [...database.sessions, session],
    dataBySession: { ...database.dataBySession, [session.id]: {} },
  };
  return selected({
    database: next,
    changed: true,
    failure: null,
    activeSessionId: next.activeSessionId,
  }, session.id);
}

export function renameTimerSession(
  database: TimerDatabase,
  sessionId: string,
  name: string,
): TimerSessionMutationResult {
  const session = database.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return unchanged(database, 'unknown-session');
  const trimmed = name.trim();
  if (!trimmed) return unchanged(database, 'empty-name');
  if (session.name === trimmed) return unchanged(database);

  const next = replaceSession(database, sessionId, (current) => ({
    ...current,
    name: trimmed,
  }));
  return { database: next, changed: true, failure: null, activeSessionId: next.activeSessionId };
}

export function clearTimerSession(
  database: TimerDatabase,
  sessionId: string,
): TimerSessionMutationResult {
  if (!database.sessions.some((session) => session.id === sessionId)) {
    return unchanged(database, 'unknown-session');
  }
  const current = database.dataBySession[sessionId] ?? {};
  if (Object.keys(current).length === 0) {
    return unchanged(database);
  }
  const next: TimerDatabase = {
    ...database,
    dataBySession: { ...database.dataBySession, [sessionId]: {} },
  };
  return { database: next, changed: true, failure: null, activeSessionId: next.activeSessionId };
}

/** Clear exactly one event bucket without touching the session's other events. */
export function clearTimerSessionEvent(
  database: TimerDatabase,
  sessionId: string,
  event: EventId,
): TimerSessionMutationResult {
  if (!database.sessions.some((session) => session.id === sessionId)) {
    return unchanged(database, 'unknown-session');
  }
  const current = database.dataBySession[sessionId] ?? {};
  if ((current[event]?.length ?? 0) === 0) return unchanged(database);

  const next: TimerDatabase = {
    ...database,
    dataBySession: {
      ...database.dataBySession,
      [sessionId]: { ...current, [event]: [] },
    },
  };
  return { database: next, changed: true, failure: null, activeSessionId: next.activeSessionId };
}

export function deleteTimerSession(
  database: TimerDatabase,
  sessionId: string,
): TimerSessionSelectionResult {
  if (!database.sessions.some((session) => session.id === sessionId)) {
    return selected(unchanged(database, 'unknown-session'), null);
  }
  if (database.sessions.length <= 1) {
    return selected(unchanged(database, 'last-session'), database.activeSessionId);
  }

  const sessions = database.sessions.filter((session) => session.id !== sessionId);
  const dataBySession = { ...database.dataBySession };
  delete dataBySession[sessionId];
  const activeSessionId = database.activeSessionId === sessionId
    ? sessions[0]!.id
    : database.activeSessionId;
  const next: TimerDatabase = {
    ...database,
    sessions,
    activeSessionId,
    dataBySession,
  };
  return selected({
    database: next,
    changed: true,
    failure: null,
    activeSessionId,
  }, activeSessionId);
}

export function associateTimerSessionEvent(
  database: TimerDatabase,
  sessionId: string,
  event: EventId,
): TimerSessionMutationResult {
  const session = database.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return unchanged(database, 'unknown-session');
  if (session.event === event) return unchanged(database);

  const next = replaceSession(database, sessionId, (current) => ({ ...current, event }));
  return { database: next, changed: true, failure: null, activeSessionId: next.activeSessionId };
}

/**
 * Activate a session associated with `event`, preferring the current session.
 * A legacy single-event inference is persisted as an explicit association.
 */
export function activateTimerSessionForEvent(
  database: TimerDatabase,
  event: EventId,
): TimerSessionSelectionResult {
  const active = database.sessions.find((session) => session.id === database.activeSessionId);
  const ordered = active
    ? [active, ...database.sessions.filter((session) => session.id !== active.id)]
    : database.sessions;
  const match = ordered.find((session) => timerSessionEvent(database, session.id) === event);
  if (!match) return selected(unchanged(database, 'no-matching-session'), null);

  const shouldAssociate = match.event === undefined;
  const shouldActivate = database.activeSessionId !== match.id;
  if (!shouldAssociate && !shouldActivate) {
    return selected(unchanged(database), match.id);
  }

  const sessions = shouldAssociate
    ? database.sessions.map((session) => (
      session.id === match.id ? { ...session, event } : session
    ))
    : database.sessions;
  const next: TimerDatabase = {
    ...database,
    sessions,
    activeSessionId: match.id,
  };
  return selected({
    database: next,
    changed: true,
    failure: null,
    activeSessionId: match.id,
  }, match.id);
}

function locateSolve(
  byEvent: TimerSolvesByEvent,
  solveId: string,
): { event: EventId; solve: Solve; index: number; solves: Solve[] } | null {
  for (const event of Object.keys(byEvent) as EventId[]) {
    const solves = byEvent[event];
    if (!solves) continue;
    const index = solves.findIndex((solve) => solve.id === solveId);
    if (index >= 0) return { event, solve: solves[index]!, index, solves };
  }
  return null;
}

/** Move one solve from the active session to another session, preserving order. */
export function moveTimerSolveToSession(
  database: TimerDatabase,
  solveId: string,
  targetSessionId: string,
): TimerSessionMutationResult {
  const sourceSessionId = database.activeSessionId;
  if (!database.sessions.some((session) => session.id === sourceSessionId)) {
    return unchanged(database, 'unknown-session');
  }
  if (!database.sessions.some((session) => session.id === targetSessionId)) {
    return unchanged(database, 'unknown-session');
  }
  if (targetSessionId === sourceSessionId) return unchanged(database, 'same-session');

  const sourceByEvent = database.dataBySession[sourceSessionId] ?? {};
  const found = locateSolve(sourceByEvent, solveId);
  if (!found) return unchanged(database, 'unknown-solve');

  const nextSourceByEvent: TimerSolvesByEvent = {
    ...sourceByEvent,
    [found.event]: [
      ...found.solves.slice(0, found.index),
      ...found.solves.slice(found.index + 1),
    ],
  };
  const targetByEvent = database.dataBySession[targetSessionId] ?? {};
  const targetSolves = targetByEvent[found.event] ?? [];
  const nextTargetByEvent: TimerSolvesByEvent = {
    ...targetByEvent,
    [found.event]: [...targetSolves, found.solve].sort((a, b) => a.ts - b.ts),
  };
  const dataBySession = {
    ...database.dataBySession,
    [sourceSessionId]: nextSourceByEvent,
    [targetSessionId]: nextTargetByEvent,
  };
  const targetSession = database.sessions.find((session) => session.id === targetSessionId)!;
  const sessions = targetSession.event
    ? database.sessions
    : database.sessions.map((session) => (
      session.id === targetSessionId ? { ...session, event: found.event } : session
    ));
  const next: TimerDatabase = { ...database, sessions, dataBySession };
  return { database: next, changed: true, failure: null, activeSessionId: next.activeSessionId };
}

export interface TimerSessionLocalizedText {
  en: string;
  zh: string;
}

/** One bilingual source consumed through Web `tr()` and Mobile's language key. */
export const TIMER_SESSION_UI_COPY = {
  session: { en: 'Session', zh: '分组' },
  sessions: { en: 'Sessions', zh: '分组' },
  switchSession: { en: 'Switch session', zh: '切换分组' },
  newSession: { en: 'New session', zh: '新建分组' },
  newSessionDefault: { en: 'New session', zh: '新分组' },
  sessionName: { en: 'Session name', zh: '分组名称' },
  newSessionName: { en: 'New session name', zh: '新分组名称' },
  clear: { en: 'Clear', zh: '清空' },
  confirm: { en: 'Confirm', zh: '确认' },
  confirmRename: { en: 'Confirm rename', zh: '确认重命名' },
  rename: { en: 'Rename', zh: '重命名' },
  renameSession: { en: 'Rename session', zh: '重命名分组' },
  clearSolves: { en: 'Clear solves', zh: '清空成绩' },
  clearSessionSolves: { en: 'Clear session solves', zh: '清空分组成绩' },
  keepOneSession: { en: 'Keep at least one session', zh: '至少保留一个分组' },
  deleteSession: { en: 'Delete session', zh: '删除分组' },
  create: { en: 'Create', zh: '创建' },
  createSession: { en: 'Create session', zh: '创建分组' },
  operationFailed: {
    en: 'Session change failed. Your existing data was kept.',
    zh: '分组操作失败，原有数据已保留。',
  },
} as const satisfies Record<string, TimerSessionLocalizedText>;

export function timerSessionClearConfirmation(name: string): TimerSessionLocalizedText {
  return {
    en: `Clear all solves in "${name}"? This cannot be undone.`,
    zh: `清空分组「${name}」的全部成绩？此操作无法撤销。`,
  };
}

export function timerSessionDeleteConfirmation(name: string): TimerSessionLocalizedText {
  return {
    en: `Delete session "${name}" and all its solves? This cannot be undone.`,
    zh: `删除分组「${name}」及其全部成绩？此操作无法撤销。`,
  };
}
