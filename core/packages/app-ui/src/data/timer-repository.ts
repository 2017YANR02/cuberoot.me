import {
  MAX_TIMER_BACKUP_BYTES,
  activateTimerSession,
  activateTimerSessionForEvent,
  associateTimerSessionEvent,
  clearTimerSession,
  clearTimerSessionEvent,
  createAndActivateTimerSession,
  createTimerStoreData,
  decodeTimerStoreData,
  deleteTimerSession,
  moveTimerSolveToSession,
  parseTimerStoreJson,
  renameTimerSession,
  restoreTimerHistorySolve,
  selectTimerEventSession,
  serializeTimerStoreData,
  summarizeTimerDatabase,
  timerDefaultSessionName,
  timerSessionSelectedEvent,
  type EventId,
  type Solve,
  type TimerSessionMutationFailure,
  type TimerSessionMutationResult,
  type TimerStoreData,
  type TimerStoreSettings,
} from '@cuberoot/shared/timer';

export interface TimerStoreDriver {
  read(): Promise<unknown | undefined>;
  readRecovery(): Promise<unknown | undefined>;
  write(data: TimerStoreData): Promise<void>;
  writeWithRecovery(data: TimerStoreData, recovery: unknown): Promise<void>;
}

export interface TimerImportPreview {
  current: ReturnType<typeof summarizeTimerDatabase>;
  incoming: ReturnType<typeof summarizeTimerDatabase>;
}

export interface TimerRepositoryEnvironment {
  now(): number;
  createId(): string;
  language(): 'en' | 'zh';
}

export class CorruptTimerStoreError extends Error {
  constructor() {
    super('Stored timer data is invalid');
    this.name = 'CorruptTimerStoreError';
  }
}

export type TimerSessionRepositoryFailure = TimerSessionMutationFailure | 'write-failure';

export class TimerSessionRepositoryError extends Error {
  constructor(
    readonly failure: TimerSessionRepositoryFailure,
    options?: ErrorOptions,
  ) {
    super(`Timer session operation failed: ${failure}`, options);
    this.name = 'TimerSessionRepositoryError';
  }
}

export interface TimerRepositorySessionSelection {
  data: TimerStoreData;
  sessionId: string | null;
}

function defaultEnvironment(): TimerRepositoryEnvironment {
  return {
    now: () => Date.now(),
    createId: () => globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    language: () => navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en',
  };
}

/**
 * Serial repository queue prevents two nearly simultaneous stop gestures or
 * imports from reading the same snapshot and dropping one write.
 */
export class TimerRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly driver: TimerStoreDriver,
    private readonly environment: TimerRepositoryEnvironment = defaultEnvironment(),
  ) {}

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation, operation);
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async loadUnlocked(): Promise<TimerStoreData> {
    const raw = await this.driver.read();
    if (raw === undefined) {
      const created = createTimerStoreData(
        this.environment.now(),
        this.environment.createId(),
        this.environment.language(),
      );
      await this.driver.write(created);
      return created;
    }
    const decoded = decodeTimerStoreData(raw);
    if (!decoded) throw new CorruptTimerStoreError();
    const storedSchemaVersion = raw !== null && typeof raw === 'object'
      ? (raw as { schemaVersion?: unknown }).schemaVersion
      : undefined;
    if (storedSchemaVersion !== decoded.schemaVersion) await this.driver.write(decoded);
    return decoded;
  }

  private async writeSessionData(data: TimerStoreData): Promise<TimerStoreData> {
    const decoded = decodeTimerStoreData(data);
    if (!decoded) throw new CorruptTimerStoreError();
    try {
      await this.driver.write(decoded);
    } catch (cause) {
      throw new TimerSessionRepositoryError('write-failure', { cause });
    }
    return decoded;
  }

  private async persistSessionMutation(
    data: TimerStoreData,
    mutation: TimerSessionMutationResult,
    selectedSessionId: string | null = null,
  ): Promise<TimerStoreData> {
    if (mutation.failure) throw new TimerSessionRepositoryError(mutation.failure);
    const effectiveEvent = timerSessionSelectedEvent(
      mutation.database,
      selectedSessionId,
      data.settings.event,
      data.settings.autoEventForSession,
    );
    const settingsChanged = effectiveEvent !== data.settings.event;
    if (!mutation.changed && !settingsChanged) return data;
    return this.writeSessionData({
      ...data,
      database: mutation.database,
      settings: settingsChanged
        ? { ...data.settings, event: effectiveEvent }
        : data.settings,
    });
  }

  load(): Promise<TimerStoreData> {
    return this.run(() => this.loadUnlocked());
  }

  save(data: TimerStoreData): Promise<TimerStoreData> {
    return this.run(async () => {
      const decoded = decodeTimerStoreData(data);
      if (!decoded) throw new CorruptTimerStoreError();
      await this.driver.write(decoded);
      return decoded;
    });
  }

  addSolve(
    input: Omit<Solve, 'id' | 'ts'>,
    targetSessionId?: string,
  ): Promise<TimerStoreData> {
    return this.run(async () => {
      const solve: Solve = {
        ...input,
        id: this.environment.createId(),
        ts: this.environment.now(),
      };
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const data = await this.loadUnlocked();
        const sessionId = targetSessionId ?? data.database.activeSessionId;
        const byEvent = data.database.dataBySession[sessionId];
        if (!byEvent) throw new TimerSessionRepositoryError('unknown-session');
        const solves = byEvent[input.event] ?? [];
        if (solves.some((entry) => entry.id === solve.id)) return data;
        byEvent[input.event] = [...solves, solve].sort((a, b) => a.ts - b.ts);
        const decoded = decodeTimerStoreData(data);
        if (!decoded) throw new CorruptTimerStoreError();
        try {
          await this.driver.write(decoded);
          return decoded;
        } catch (error) {
          if (attempt === 1) {
            const confirmed = await this.loadUnlocked().catch(() => null);
            const confirmedSolves = confirmed?.database
              .dataBySession[sessionId]?.[input.event] ?? [];
            if (confirmed && confirmedSolves.some((entry) => entry.id === solve.id)) {
              return confirmed;
            }
            throw error;
          }
        }
      }
      throw new Error('Unreachable timer write retry state');
    });
  }

  updateSolve(
    event: EventId,
    id: string,
    changes: Partial<Pick<Solve, 'penalty' | 'comment'>>,
  ): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const byEvent = data.database.dataBySession[data.database.activeSessionId];
      const solves = byEvent[event] ?? [];
      byEvent[event] = solves.map((solve) => (
        solve.id === id ? { ...solve, ...changes } : solve
      ));
      const decoded = decodeTimerStoreData(data);
      if (!decoded) throw new CorruptTimerStoreError();
      await this.driver.write(decoded);
      return decoded;
    });
  }

  deleteSolve(event: EventId, id: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const byEvent = data.database.dataBySession[data.database.activeSessionId];
      byEvent[event] = (byEvent[event] ?? []).filter((solve) => solve.id !== id);
      const decoded = decodeTimerStoreData(data);
      if (!decoded) throw new CorruptTimerStoreError();
      await this.driver.write(decoded);
      return decoded;
    });
  }

  restoreSolve(sessionId: string, solve: Solve): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const byEvent = data.database.dataBySession[sessionId];
      if (!byEvent) throw new TimerSessionRepositoryError('unknown-session');
      const restored = restoreTimerHistorySolve(byEvent[solve.event] ?? [], solve);
      if (!restored.changed) return data;
      return this.writeSessionData({
        ...data,
        database: {
          ...data.database,
          dataBySession: {
            ...data.database.dataBySession,
            [sessionId]: { ...byEvent, [solve.event]: restored.solves },
          },
        },
      });
    });
  }

  updateSettings(changes: Partial<TimerStoreSettings>): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const candidate = { ...data, settings: { ...data.settings, ...changes } };
      const decoded = decodeTimerStoreData(candidate);
      if (!decoded) throw new CorruptTimerStoreError();
      await this.driver.write(decoded);
      return decoded;
    });
  }

  activateSession(sessionId: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const mutation = activateTimerSession(data.database, sessionId);
      return this.persistSessionMutation(
        data,
        mutation,
        mutation.sessionId,
      );
    });
  }

  /** Create and activate with one queued IndexedDB write. */
  createSession(name: string, event: EventId): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      let sessionId = this.environment.createId();
      let created = createAndActivateTimerSession(data.database, {
        id: sessionId,
        name,
        createdTs: this.environment.now(),
        fallbackName: timerDefaultSessionName(this.environment.language()),
        event,
      });
      while (created.failure === 'duplicate-session-id') {
        sessionId = this.environment.createId();
        created = createAndActivateTimerSession(data.database, {
          id: sessionId,
          name,
          createdTs: this.environment.now(),
          fallbackName: timerDefaultSessionName(this.environment.language()),
          event,
        });
      }
      if (created.failure) throw new TimerSessionRepositoryError(created.failure);
      return this.persistSessionMutation(
        data,
        created,
        created.sessionId,
      );
    });
  }

  renameSession(sessionId: string, name: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      return this.persistSessionMutation(
        data,
        renameTimerSession(data.database, sessionId, name),
      );
    });
  }

  clearSession(sessionId: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      return this.persistSessionMutation(data, clearTimerSession(data.database, sessionId));
    });
  }

  clearSessionEvent(sessionId: string, event: EventId): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      return this.persistSessionMutation(
        data,
        clearTimerSessionEvent(data.database, sessionId, event),
      );
    });
  }

  deleteSession(sessionId: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const mutation = deleteTimerSession(data.database, sessionId);
      return this.persistSessionMutation(data, mutation, mutation.sessionId);
    });
  }

  setSessionEvent(sessionId: string, event: EventId): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      return this.persistSessionMutation(
        data,
        associateTimerSessionEvent(data.database, sessionId, event),
      );
    });
  }

  activateSessionForEvent(event: EventId): Promise<TimerRepositorySessionSelection> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const mutation = activateTimerSessionForEvent(data.database, event);
      if (mutation.failure === 'no-matching-session') return { data, sessionId: null };
      const persisted = await this.persistSessionMutation(data, mutation);
      return { data: persisted, sessionId: mutation.sessionId };
    });
  }

  /**
   * Match Web's event/session coupling atomically: auto-match selects an
   * existing associated session when possible; otherwise the active session
   * is associated with the newly selected event.
   */
  selectEvent(event: EventId): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const selected = selectTimerEventSession(
        data.database,
        event,
        data.settings.autoSessionForEvent,
      );
      if (selected.failure) throw new TimerSessionRepositoryError(selected.failure);
      if (data.settings.event === event && !selected.changed) return data;
      return this.writeSessionData({
        ...data,
        database: selected.database,
        settings: { ...data.settings, event },
      });
    });
  }

  moveSolveToSession(solveId: string, targetSessionId: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      return this.persistSessionMutation(
        data,
        moveTimerSolveToSession(data.database, solveId, targetSessionId),
      );
    });
  }

  exportJson(): Promise<string> {
    return this.run(async () => serializeTimerStoreData(await this.loadUnlocked()));
  }

  private assertBackupSize(text: string): void {
    if (new TextEncoder().encode(text).byteLength > MAX_TIMER_BACKUP_BYTES) {
      throw new CorruptTimerStoreError();
    }
  }

  private async importContext(): Promise<{
    current: TimerStoreData;
    raw: unknown;
  }> {
    const raw = await this.driver.read();
    const decoded = raw === undefined ? undefined : decodeTimerStoreData(raw);
    return {
      current: decoded ?? createTimerStoreData(
        this.environment.now(),
        this.environment.createId(),
        this.environment.language(),
      ),
      raw,
    };
  }

  private migrationEnvironment() {
    return {
      nowMs: this.environment.now(),
      sessionId: this.environment.createId(),
      language: this.environment.language(),
    };
  }

  previewImport(text: string): Promise<TimerImportPreview> {
    return this.run(async () => {
      this.assertBackupSize(text);
      const { current } = await this.importContext();
      const incoming = parseTimerStoreJson(text, current.settings, this.migrationEnvironment());
      if (!incoming) throw new CorruptTimerStoreError();
      return {
        current: summarizeTimerDatabase(current.database),
        incoming: summarizeTimerDatabase(incoming.database),
      };
    });
  }

  importJson(text: string): Promise<TimerStoreData> {
    return this.run(async () => {
      this.assertBackupSize(text);
      const { current, raw } = await this.importContext();
      const parsed = parseTimerStoreJson(text, current.settings, this.migrationEnvironment());
      if (!parsed) throw new CorruptTimerStoreError();
      await this.driver.writeWithRecovery(parsed, raw);
      return parsed;
    });
  }

  hasImportRecovery(): Promise<boolean> {
    return this.run(async () => decodeTimerStoreData(await this.driver.readRecovery()) !== null);
  }

  restoreImportRecovery(): Promise<TimerStoreData> {
    return this.run(async () => {
      const recovery = decodeTimerStoreData(await this.driver.readRecovery());
      if (!recovery) throw new CorruptTimerStoreError();
      await this.driver.writeWithRecovery(recovery, undefined);
      return recovery;
    });
  }
}

const DB_NAME = 'cuberoot-mobile';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const TIMER_KEY = 'timer';
const RECOVERY_KEY = 'timer-before-import';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'));
  });
}

export class IndexedDbTimerStoreDriver implements TimerStoreDriver {
  async read(): Promise<unknown | undefined> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const done = transactionDone(transaction);
      const value = await requestResult(transaction.objectStore(STORE_NAME).get(TIMER_KEY));
      await done;
      return value;
    } finally {
      database.close();
    }
  }

  async write(data: TimerStoreData): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const done = transactionDone(transaction);
      transaction.objectStore(STORE_NAME).put(data, TIMER_KEY);
      await done;
    } finally {
      database.close();
    }
  }

  async readRecovery(): Promise<unknown | undefined> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const done = transactionDone(transaction);
      const value = await requestResult(transaction.objectStore(STORE_NAME).get(RECOVERY_KEY));
      await done;
      return value;
    } finally {
      database.close();
    }
  }

  async writeWithRecovery(data: TimerStoreData, recovery: unknown): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const done = transactionDone(transaction);
      const store = transaction.objectStore(STORE_NAME);
      if (recovery === undefined) store.delete(RECOVERY_KEY);
      else store.put(recovery, RECOVERY_KEY);
      store.put(data, TIMER_KEY);
      await done;
    } finally {
      database.close();
    }
  }
}
