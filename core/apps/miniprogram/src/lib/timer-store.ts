// Restored from the original WeChat native timer (7cb3e75349); public imports updated.
import {
  createTimerStoreData,
  decodeTimerStoreData,
  type TimerStoreData,
} from '@cuberoot/shared/timer/persistence';
import type { Solve } from '@cuberoot/shared/timer/types';

export interface TimerStoreEnvironment {
  nowMs: number;
  id: string;
  language?: 'en' | 'zh';
}

export interface LoadedTimerStore {
  data: TimerStoreData;
  recoveredFromCorruption: boolean;
}

function isMissingStorage(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function loadOrCreateTimerStore(
  raw: unknown,
  environment: TimerStoreEnvironment,
): LoadedTimerStore {
  if (isMissingStorage(raw)) {
    return {
      data: createTimerStoreData(environment.nowMs, environment.id, environment.language ?? 'zh'),
      recoveredFromCorruption: false,
    };
  }
  const decoded = decodeTimerStoreData(raw);
  if (decoded) return { data: decoded, recoveredFromCorruption: false };
  return {
    data: createTimerStoreData(environment.nowMs, environment.id, environment.language ?? 'zh'),
    recoveredFromCorruption: true,
  };
}

export function appendTimerSolve(
  data: TimerStoreData,
  solve: Solve,
): TimerStoreData {
  const sessionId = data.database.activeSessionId;
  const existingByEvent = data.database.dataBySession[sessionId];
  if (!existingByEvent) throw new Error('Active timer session is missing');
  const existingSolves = existingByEvent[solve.event] ?? [];
  if (existingSolves.some((item) => item.id === solve.id)) {
    throw new Error('Duplicate solve id');
  }
  const candidate: TimerStoreData = {
    ...data,
    database: {
      ...data.database,
      dataBySession: {
        ...data.database.dataBySession,
        [sessionId]: {
          ...existingByEvent,
          [solve.event]: [...existingSolves, solve].sort((a, b) => a.ts - b.ts),
        },
      },
    },
  };
  const decoded = decodeTimerStoreData(candidate);
  if (!decoded) throw new Error('Invalid solve data');
  return decoded;
}
