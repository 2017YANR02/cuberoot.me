/**
 * 5x5 打乱模式偏好 — `random-state`(走 cube555 daemon)或 `random-move`(WCA 60 步,cubing.js)。
 * localStorage 持久,同 tab 内的多个消费者通过自定义事件保持同步(`storage` 事件
 * 只对其它 tab 触发,自己写入不会回调,所以加一个内部 broadcast 事件)。
 *
 * cubingScramble.ts 在每次生成时 `get555Mode()` 决定走哪条路径,**并监听 mode-change
 * 事件,在切换时清掉 555 pool**,防止已缓存的 random-state 在用户切到 random-move
 * 后还被 pop 出去。
 */
import { useEffect, useState } from 'react';

export type Scramble555Mode = 'rs' | 'rm';

const KEY = 'cuberoot.gen.555_mode';
const EVENT = 'cuberoot:555-mode-change';
const DEFAULT: Scramble555Mode = 'rs';

export function get555Mode(): Scramble555Mode {
  if (typeof localStorage === 'undefined') return DEFAULT;
  const v = localStorage.getItem(KEY);
  return v === 'rm' ? 'rm' : DEFAULT;
}

export function set555Mode(mode: Scramble555Mode): void {
  if (typeof localStorage === 'undefined') return;
  if (get555Mode() === mode) return;
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function on555ModeChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, handler);
  // `storage` event fires on OTHER tabs when localStorage changes — useful for
  // multi-window dev but not strictly required.
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/** React hook — read + write + re-render on cross-component changes. */
export function use555Mode(): [Scramble555Mode, (m: Scramble555Mode) => void] {
  const [mode, setLocal] = useState<Scramble555Mode>(() => get555Mode());
  useEffect(() => on555ModeChange(() => setLocal(get555Mode())), []);
  return [mode, set555Mode];
}
