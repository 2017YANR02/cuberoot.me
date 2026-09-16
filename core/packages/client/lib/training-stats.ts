import { persistItem } from './safe-storage';

// Keep the existing Cross storage and group names: old totals remain authoritative.
export const TRAINING_STATS_KEY = 'cuberoot-timer.stage-training.stats.v1';
export interface TrainingAttempt {
  id: string;
  at: number;
  correct: boolean | null;
  durationMs?: number;
}
export interface TrainingStats {
  total: number;
  correct: number;
  wrong: number;
  timed: number;
  totalMs: number;
  bestMs: number | null;
  recent: TrainingAttempt[];
}
export const EMPTY_TRAINING_STATS: TrainingStats = {
  total: 0, correct: 0, wrong: 0, timed: 0, totalMs: 0, bestMs: null, recent: [],
};
type StatsStore = Record<string, TrainingStats>;
const EMPTY_STORE: StatsStore = {};
let snapshot: StatsStore = EMPTY_STORE;
let lastRaw: string | null | undefined;
let unsaved = false;
const listeners = new Set<() => void>();
const count = (n: unknown): number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;

export function parseTrainingStats(raw: string | null): StatsStore {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([key, line]) => {
      if (!line || typeof line !== 'object' || Array.isArray(line)) return [];
      const total = count(line.total);
      const correct = Math.min(total, count(line.correct));
      const wrong = Math.min(total - correct, count(line.wrong));
      return [[key, {
        total, correct, wrong,
        timed: Math.min(total, count(line.timed)), totalMs: count(line.totalMs),
        bestMs: count(line.timed) > 0 && typeof line.bestMs === 'number'
          && Number.isSafeInteger(line.bestMs) && line.bestMs >= 0 ? line.bestMs : null,
        recent: Array.isArray(line.recent) ? line.recent.filter((a: TrainingAttempt) => a
          && typeof a.id === 'string' && Number.isSafeInteger(a.at) && a.at >= 0 && a.at <= 8_640_000_000_000_000
          && (a.correct === true || a.correct === false || a.correct === null)
          && (a.durationMs === undefined || (Number.isSafeInteger(a.durationMs) && a.durationMs >= 0))).slice(-50) : [],
      }]];
    }));
  } catch { return {}; }
}

export function getTrainingStatsSnapshot(): StatsStore {
  if (typeof window === 'undefined') return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(TRAINING_STATS_KEY);
    if (raw !== lastRaw) {
      snapshot = parseTrainingStats(raw);
      lastRaw = raw;
      unsaved = false;
    }
  } catch { /* Keep this tab's results when storage is unavailable. */ }
  return snapshot;
}

export const getTrainingStatsServerSnapshot = () => EMPTY_STORE;
export const trainingStatsUnsaved = () => unsaved;

export function subscribeTrainingStats(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === TRAINING_STATS_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function addTrainingAttempt(stats: TrainingStats, attempt: TrainingAttempt): TrainingStats {
  if (stats.recent.some(item => item.id === attempt.id)) return stats;
  const durationMs = attempt.durationMs;
  const timed = durationMs !== undefined && Number.isSafeInteger(durationMs) && durationMs >= 0;
  const entry = { ...attempt, durationMs: timed ? durationMs : undefined };
  return {
    total: stats.total + 1,
    correct: stats.correct + (attempt.correct === true ? 1 : 0),
    wrong: stats.wrong + (attempt.correct === false ? 1 : 0),
    timed: stats.timed + (timed ? 1 : 0),
    totalMs: stats.totalMs + (timed ? durationMs : 0),
    bestMs: timed ? Math.min(stats.bestMs ?? Infinity, durationMs) : stats.bestMs,
    recent: [...stats.recent, entry].slice(-50),
  };
}

function save(next: StatsStore): void {
  snapshot = next;
  const raw = JSON.stringify(next);
  unsaved = !persistItem(TRAINING_STATS_KEY, raw);
  if (!unsaved) lastRaw = raw;
  listeners.forEach(listener => listener());
}

export function recordTrainingAttempt(group: string, attempt: TrainingAttempt): void {
  const store = getTrainingStatsSnapshot();
  const current = store[group] ?? EMPTY_TRAINING_STATS;
  const next = addTrainingAttempt(current, attempt);
  if (next !== current) save({ ...store, [group]: next });
}

export function resetTrainingStats(group: string): void {
  save({ ...getTrainingStatsSnapshot(), [group]: EMPTY_TRAINING_STATS });
}
