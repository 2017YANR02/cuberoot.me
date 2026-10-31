'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SOLO_LAYOUT, normalizeSoloLayout } from '@cuberoot/shared/timer';
import type { TimerSoloLayoutSettings } from '@cuberoot/timer-ui';

const storageKey = 'cuberoot.trainer.layout';
const defaults: TimerSoloLayoutSettings = {
  soloLayout: { ...DEFAULT_SOLO_LAYOUT }, timerFontScale: 1, scrambleFontScale: 1,
};
const scale = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 1;

/** Trainer preferences use the timer's layout contract without changing its saved layout. */
export function useTrainerLayout() {
  const [settings, setSettings] = useState(defaults);
  const current = useRef(settings);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (!saved) return;
      const next = { soloLayout: normalizeSoloLayout(saved.soloLayout),
        timerFontScale: scale(saved.timerFontScale, 0.5, 2),
        scrambleFontScale: scale(saved.scrambleFontScale, 0.6, 2.5) };
      current.current = next;
      setSettings(next);
    } catch { /* Storage may be unavailable. */ }
  }, []);
  const getSettings = useCallback(() => current.current, []);
  const updateSettings = useCallback((patch: Partial<TimerSoloLayoutSettings>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setSettings(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep in-memory preferences. */ }
  }, []);
  return { settings, getSettings, updateSettings };
}
