import { useSyncExternalStore } from 'react';
import { persistItem } from './safe-storage';

export type RediScrambleMode = 'timer' | 'rotations';
const KEY = 'cuberoot.gen.redi_mode';
const EVENT = 'cuberoot:redi-mode-change';

export function getRediMode(): RediScrambleMode {
  if (typeof localStorage === 'undefined') return 'timer';
  return localStorage.getItem(KEY) === 'rotations' ? 'rotations' : 'timer';
}

export function setRediMode(mode: RediScrambleMode): void {
  if (typeof localStorage === 'undefined' || getRediMode() === mode) return;
  persistItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onRediModeChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function useRediMode(): [RediScrambleMode, typeof setRediMode] {
  const mode = useSyncExternalStore(onRediModeChange, getRediMode, () => 'timer' as const);
  return [mode, setRediMode];
}
