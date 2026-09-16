'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  EMPTY_TRAINING_STATS, getTrainingStatsSnapshot, getTrainingStatsServerSnapshot,
  subscribeTrainingStats, recordTrainingAttempt, resetTrainingStats, trainingStatsUnsaved,
} from '@/lib/training-stats';

export function useTrainingStats(group: string) {
  const store = useSyncExternalStore(subscribeTrainingStats, getTrainingStatsSnapshot, getTrainingStatsServerSnapshot);
  const record = useCallback((correct: boolean | null, durationMs?: number, id?: string) => {
    // getRandomValues also works in local HTTP previews, where randomUUID is unavailable.
    const eventId = id ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), word => word.toString(16).padStart(8, '0')).join('');
    recordTrainingAttempt(group, { id: eventId, at: Date.now(), correct, durationMs: durationMs === undefined ? undefined : Math.round(durationMs) });
  }, [group]);
  const reset = useCallback(() => resetTrainingStats(group), [group]);
  return { stats: store[group] ?? EMPTY_TRAINING_STATS, record, reset, unsaved: trainingStatsUnsaved() };
}
