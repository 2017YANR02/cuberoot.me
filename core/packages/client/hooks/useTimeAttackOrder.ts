'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthUser } from '@/lib/auth-store';
import {
  fetchCloudTimeAttackOrder, newerTimeAttackOrder, normalizeTimeAttackOrder,
  readLocalTimeAttackOrder, saveCloudTimeAttackOrder, writeLocalTimeAttackOrder,
  type TimeAttackOrderSnapshot,
} from '@/lib/alg-time-attack-order';

export type TimeAttackSyncState = 'local' | 'loading' | 'saving' | 'saved' | 'error';

/** One order and sync contract for the case-order page and timed chains. */
export function useTimeAttackOrder(puzzle: string, setSlug: string, scope: string, canonicalKeys: readonly string[]) {
  const user = useAuthUser();
  const [order, setOrder] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<TimeAttackSyncState>('local');
  const saveSequence = useRef(0);
  const lastUpdated = useRef(0);

  useEffect(() => {
    let active = true;
    ++saveSequence.current;
    if (canonicalKeys.length === 0) { setOrder([]); return; }
    const local = readLocalTimeAttackOrder(puzzle, setSlug, scope);
    lastUpdated.current = local?.updatedAt ?? 0;
    setOrder(normalizeTimeAttackOrder(canonicalKeys, local?.keys));
    setSyncState(user ? 'loading' : 'local');
    if (!user) return () => { active = false; ++saveSequence.current; };
    const fetchSequence = saveSequence.current;
    void fetchCloudTimeAttackOrder(puzzle, setSlug, scope).then(async cloud => {
      if (!active) return;
      // Re-read after the request: a local drag during loading wins.
      const currentLocal = readLocalTimeAttackOrder(puzzle, setSlug, scope);
      const winner = newerTimeAttackOrder(currentLocal, cloud);
      const keys = normalizeTimeAttackOrder(canonicalKeys, winner?.keys);
      let snapshot: TimeAttackOrderSnapshot | null = winner ? { ...winner, keys } : null;
      const repaired = !!winner && (winner.keys.length !== keys.length || winner.keys.some((key, i) => key !== keys[i]));
      if (repaired) snapshot = { keys, updatedAt: Math.max(Date.now(), winner.updatedAt + 1) };
      setOrder(keys);
      const sequence = saveSequence.current;
      if (snapshot) {
        lastUpdated.current = Math.max(lastUpdated.current, snapshot.updatedAt);
        writeLocalTimeAttackOrder(puzzle, setSlug, scope, snapshot);
      }
      if (snapshot && (repaired || !cloud || snapshot.updatedAt > cloud.updatedAt)) {
        await saveCloudTimeAttackOrder(puzzle, setSlug, scope, snapshot);
      }
      if (active && sequence === saveSequence.current) setSyncState('saved');
    }).catch(() => { if (active && fetchSequence === saveSequence.current) setSyncState('error'); });
    return () => { active = false; ++saveSequence.current; };
  }, [canonicalKeys, puzzle, scope, setSlug, user]);

  const persistOrder = useCallback((requested: readonly string[]) => {
    const keys = normalizeTimeAttackOrder(canonicalKeys, requested);
    const updatedAt = Math.max(Date.now(), lastUpdated.current + 1);
    lastUpdated.current = updatedAt;
    const snapshot = { keys, updatedAt };
    setOrder(keys);
    const saved = writeLocalTimeAttackOrder(puzzle, setSlug, scope, snapshot);
    if (!user) { setSyncState(saved ? 'local' : 'error'); return; }
    const sequence = ++saveSequence.current;
    setSyncState('saving');
    void saveCloudTimeAttackOrder(puzzle, setSlug, scope, snapshot).then(() => {
      if (sequence === saveSequence.current) setSyncState('saved');
    }).catch(() => { if (sequence === saveSequence.current) setSyncState('error'); });
  }, [canonicalKeys, puzzle, scope, setSlug, user]);

  return { order, syncState, persistOrder };
}
