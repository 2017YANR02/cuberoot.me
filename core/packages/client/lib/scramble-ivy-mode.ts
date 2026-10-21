import { ivyScrambleToRlub } from '@cuberoot/puzzle-solvers/ivy';
import { persistItem } from './safe-storage';

export type IvyScrambleMode = 'rldb' | 'rlub';
const KEY = 'cuberoot.gen.ivy_mode';
const EVENT = 'cuberoot:ivy-mode-change';

export function getIvyMode(): IvyScrambleMode {
  return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'rlub' ? 'rlub' : 'rldb';
}

export function setIvyMode(mode: IvyScrambleMode): void {
  if (typeof localStorage === 'undefined' || getIvyMode() === mode) return;
  persistItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onIvyModeChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/** Convert before storing a generated scramble; rendering and playback consume the saved text. */
export function ivyScrambleForMode(scramble: string, mode: IvyScrambleMode): string {
  return mode === 'rlub' && scramble ? ivyScrambleToRlub(scramble) : scramble;
}
