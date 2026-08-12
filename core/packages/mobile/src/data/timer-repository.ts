import {
  createTimerStoreData,
  decodeTimerStoreData,
  parseTimerStoreJson,
  serializeTimerStoreData,
  type EventId,
  type Solve,
  type TimerStoreData,
  type TimerStoreSettings,
} from '@cuberoot/shared/timer';

export interface TimerStoreDriver {
  read(): Promise<unknown | undefined>;
  write(data: TimerStoreData): Promise<void>;
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
    return decoded;
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

  addSolve(input: Omit<Solve, 'id' | 'ts'>): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const solve: Solve = {
        ...input,
        id: this.environment.createId(),
        ts: this.environment.now(),
      };
      const byEvent = data.dataBySession[data.activeSessionId];
      byEvent[input.event] = [...(byEvent[input.event] ?? []), solve]
        .sort((a, b) => a.ts - b.ts);
      const decoded = decodeTimerStoreData(data);
      if (!decoded) throw new CorruptTimerStoreError();
      await this.driver.write(decoded);
      return decoded;
    });
  }

  updateSolve(
    event: EventId,
    id: string,
    changes: Pick<Solve, 'penalty' | 'comment'>,
  ): Promise<TimerStoreData> {
    return this.run(async () => {
      const data = await this.loadUnlocked();
      const byEvent = data.dataBySession[data.activeSessionId];
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
      const byEvent = data.dataBySession[data.activeSessionId];
      byEvent[event] = (byEvent[event] ?? []).filter((solve) => solve.id !== id);
      const decoded = decodeTimerStoreData(data);
      if (!decoded) throw new CorruptTimerStoreError();
      await this.driver.write(decoded);
      return decoded;
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

  exportJson(): Promise<string> {
    return this.run(async () => serializeTimerStoreData(await this.loadUnlocked()));
  }

  importJson(text: string): Promise<TimerStoreData> {
    return this.run(async () => {
      const parsed = parseTimerStoreJson(text);
      if (!parsed) throw new CorruptTimerStoreError();
      await this.driver.write(parsed);
      return parsed;
    });
  }
}

const DB_NAME = 'cuberoot-mobile';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const TIMER_KEY = 'timer';

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
}
