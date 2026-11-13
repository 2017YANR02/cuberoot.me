import { useEffect, useRef, useState, type SetStateAction } from 'react';

type Versions<T> = Partial<Record<keyof T, number>>;
interface Submission<T> { resourceId: string; versions: Versions<T> }

/** Refresh untouched fields while preserving edits made after the last server snapshot. */
export function usePlatformFormDraft<T extends object>(resourceId: string, initial: T) {
  const [values, setValues] = useState(initial);
  const scope = useRef(resourceId);
  const current = useRef(initial);
  const edited = useRef<Versions<T>>({});
  const accepted = useRef<Versions<T>>({});

  useEffect(() => {
    const changedResource = scope.current !== resourceId;
    scope.current = resourceId;
    if (changedResource) { edited.current = {}; accepted.current = {}; }
    const next = { ...initial };
    if (!changedResource) {
      for (const key of Object.keys(initial) as Array<keyof T>) {
        if ((edited.current[key] ?? 0) !== (accepted.current[key] ?? 0)) next[key] = current.current[key];
      }
    }
    current.current = next;
    setValues(next);
  }, [resourceId, initial]);

  const update = (action: SetStateAction<T>) => {
    const next = typeof action === 'function' ? (action as (value: T) => T)(current.current) : action;
    for (const key of Object.keys(next) as Array<keyof T>) {
      if (JSON.stringify(next[key]) !== JSON.stringify(current.current[key])) edited.current[key] = (edited.current[key] ?? 0) + 1;
    }
    current.current = next;
    setValues(next);
  };
  const submission = (): Submission<T> => ({ resourceId, versions: { ...edited.current } });
  const isCurrent = (token: Submission<T>) => scope.current === token.resourceId
    && (Object.keys(current.current) as Array<keyof T>).every(key => (edited.current[key] ?? 0) === (token.versions[key] ?? 0));
  const accept = (token: Submission<T>) => {
    if (scope.current !== token.resourceId) return;
    for (const key of Object.keys(current.current) as Array<keyof T>) {
      if ((edited.current[key] ?? 0) !== (token.versions[key] ?? 0)) continue;
      accepted.current[key] = token.versions[key] ?? 0;
    }
  };
  return { values, setValues: update, submission, isCurrent, accept };
}
