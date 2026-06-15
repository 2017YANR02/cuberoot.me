/**
 * 3x3 打乱引擎偏好 — `wca`(cubing.js,WCA 官方版的引擎)或 `m2p`(min2phase-rust,
 * cs0x7f 的 Kociemba 实现,~10× 快但同算法家族,平均长度差 < 0.1 步)。
 *
 * 默认 wca。localStorage 持久,同 tab 多个消费者通过自定义事件同步。
 * 切换会清掉 333 / 333oh / 333bf / 333mbf / 333fm / 333ft / 333mbo 这些
 * 共用 cubing.js 路径的事件 pool。
 */
import { useEffect, useState } from 'react';

export type Scramble333Mode = 'wca' | 'm2p';

const KEY = 'cuberoot.gen.333_mode';
const EVENT = 'cuberoot:333-mode-change';
const DEFAULT: Scramble333Mode = 'wca';

export function get333Mode(): Scramble333Mode {
  if (typeof localStorage === 'undefined') return DEFAULT;
  const v = localStorage.getItem(KEY);
  return v === 'm2p' ? 'm2p' : DEFAULT;
}

export function set333Mode(mode: Scramble333Mode): void {
  if (typeof localStorage === 'undefined') return;
  if (get333Mode() === mode) return;
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function on333ModeChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function use333Mode(): [Scramble333Mode, (m: Scramble333Mode) => void] {
  const [mode, setLocal] = useState<Scramble333Mode>(() => get333Mode());
  useEffect(() => on333ModeChange(() => setLocal(get333Mode())), []);
  return [mode, set333Mode];
}
