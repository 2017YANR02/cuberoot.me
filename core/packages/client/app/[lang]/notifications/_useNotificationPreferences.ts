'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Both subscription sections share serialization, rollback and unmount isolation. */
export function useNotificationPreferences<P, S extends { preferences: P }>(read: () => Promise<S>, save: (p: P) => Promise<void>) {
  const [settings, setSettings] = useState<S | null>(null);
  const [draft, setDraft] = useState<P | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setError('');
    try {
      const result = await read();
      if (generation.current !== version) return;
      setSettings(result); setDraft(result.preferences);
    } catch (e) { if (generation.current === version) setError(e instanceof Error ? e.message : String(e)); }
  }, [read]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);

  async function change(value: Partial<P>) {
    if (!draft || busy.current) return;
    const previous = draft;
    const next = { ...previous, ...value };
    const version = generation.current;
    busy.current = true; setDraft(next); setSaving(true); setError('');
    try { await save(next); }
    catch (e) {
      if (generation.current === version) { setDraft(previous); setError(e instanceof Error ? e.message : String(e)); }
    } finally {
      if (generation.current === version) { busy.current = false; setSaving(false); }
    }
  }
  return { settings, draft, error, saving, change, load };
}
