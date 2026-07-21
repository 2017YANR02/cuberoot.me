/**
 * 2x2 打乱口径 — `wca`(WCA 官方:恰好 11 步、握位代价最小,= TNoodle generateExactly)或
 * `optimal`(HTM 最短、Q|H tie-break、同样握位代价最小,均 ~8.8 步)。两者都只含 U/R/F。
 *
 * 默认 optimal(最短、多数练习者更在意的口径)。localStorage 持久,同 tab 多消费者通过自定义
 * 事件同步。切换会清掉 222 pool(见 lib/cubing-scramble)。
 */
import { useEffect, useState } from 'react';
import { persistItem } from './safe-storage';

export type Scramble222Mode = 'wca' | 'optimal';

const KEY = 'cuberoot.gen.222_mode';
const EVENT = 'cuberoot:222-mode-change';
const DEFAULT: Scramble222Mode = 'optimal';

export function get222Mode(): Scramble222Mode {
  if (typeof localStorage === 'undefined') return DEFAULT;
  return localStorage.getItem(KEY) === 'wca' ? 'wca' : DEFAULT;
}

export function set222Mode(mode: Scramble222Mode): void {
  if (typeof localStorage === 'undefined') return;
  if (get222Mode() === mode) return;
  persistItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function on222ModeChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function use222Mode(): [Scramble222Mode, (m: Scramble222Mode) => void] {
  const [mode, setLocal] = useState<Scramble222Mode>(() => get222Mode());
  useEffect(() => on222ModeChange(() => setLocal(get222Mode())), []);
  return [mode, set222Mode];
}
