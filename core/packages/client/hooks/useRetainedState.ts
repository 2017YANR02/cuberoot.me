'use client';

import { useCallback, useRef, useSyncExternalStore, type SetStateAction } from 'react';
import { useAuthStore, type WcaUser } from '@/lib/auth-store';

// Only the current browser session; never persisted to storage or used for SSR.
// Callers keep their normal refresh effects and retain content while refreshing.
const values = new Map<string, unknown>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
let unsubscribeAuth: (() => void) | undefined;
let generation = 0;
const identity = (user: WcaUser | null) => user ? `${user.uid ?? user.wcaId}:${user.isAdmin}` : 'guest';
const owner = () => `${identity(useAuthStore.getState().user)}:${generation}`;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  unsubscribeAuth ??= useAuthStore.subscribe((next, previous) => {
    if (identity(next.user) !== identity(previous.user)) {
      generation++;
      values.clear();
      emit();
    }
  });
  return () => { listeners.delete(listener); };
};

/** Preserve loaded page data across route unmounts, with a stable SSR snapshot. */
export function useRetainedState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const scope = useSyncExternalStore(subscribe, owner, () => 'guest:0');
  const scopedKey = `${scope}:${key}`;
  const value = useSyncExternalStore(
    subscribe,
    () => values.has(scopedKey) ? values.get(scopedKey) as T : initialRef.current,
    () => initialRef.current,
  );
  const setValue = useCallback((next: SetStateAction<T>) => {
    // A request started for a previous identity must not repopulate its cache.
    if (scope !== owner()) return;
    const previous = values.has(scopedKey) ? values.get(scopedKey) as T : initialRef.current;
    const result = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
    if (Object.is(previous, result)) return;
    values.set(scopedKey, result);
    emit();
  }, [scope, scopedKey]);
  return [value, setValue] as const;
}
