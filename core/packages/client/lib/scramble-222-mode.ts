/**
 * 2x2 打乱设置:
 * - 完整状态口径:`wca`(WCA 官方:恰好 11 步、握位代价最小,= TNoodle generateExactly)或
 *   `optimal`(HTM 最短、Q|H tie-break、同样握位代价最小,均 ~8.8 步)。两者都只含 U/R/F。
 * - 计时器专项类型:完整状态 / 3-gen / EG 系列 / TCLL 系列 / LS / 无连色。专项打乱只登记
 *   csTimer 已有的 scrambler key,实际生成仍统一走 timer 的 vendored worker。
 *
 * 两项独立持久化:切到专项类型再切回完整状态时,原口径不丢；同 tab 多消费者通过自定义事件同步。
 * 口径切换会清掉 222 pool(见 lib/cubing-scramble)。
 */
import { useEffect, useState } from 'react';
import { persistItem } from './safe-storage';
import {
  DEFAULT_SCRAMBLE_222_MODE,
  DEFAULT_SCRAMBLE_222_TYPE,
  isScramble222Mode,
  isScramble222Type,
  type Scramble222Mode,
  type Scramble222Type,
} from '@cuberoot/shared/timer';

export {
  cstimer222Spec,
  isCube222StateType,
  SCRAMBLE_222_TYPE_CATALOG,
  SCRAMBLE_222_TYPES,
  WCA_SCRAMBLE_222_TYPES,
} from '@cuberoot/shared/timer';
export type { Scramble222Mode, Scramble222Type } from '@cuberoot/shared/timer';

const KEY = 'cuberoot.gen.222_mode';
const TYPE_KEY = 'cuberoot.gen.222_type';
const EVENT = 'cuberoot:222-mode-change';
export function get222Mode(): Scramble222Mode {
  if (typeof localStorage === 'undefined') return DEFAULT_SCRAMBLE_222_MODE;
  const stored = localStorage.getItem(KEY);
  return isScramble222Mode(stored) ? stored : DEFAULT_SCRAMBLE_222_MODE;
}

export function set222Mode(mode: Scramble222Mode): void {
  if (typeof localStorage === 'undefined') return;
  if (get222Mode() === mode) return;
  persistItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function get222Type(): Scramble222Type {
  if (typeof localStorage === 'undefined') return DEFAULT_SCRAMBLE_222_TYPE;
  const stored = localStorage.getItem(TYPE_KEY);
  return isScramble222Type(stored) ? stored : DEFAULT_SCRAMBLE_222_TYPE;
}

export function set222Type(type: Scramble222Type): void {
  if (typeof localStorage === 'undefined') return;
  if (get222Type() === type) return;
  persistItem(TYPE_KEY, type);
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

export function use222Type(): [Scramble222Type, (t: Scramble222Type) => void] {
  const [type, setLocal] = useState<Scramble222Type>(() => get222Type());
  useEffect(() => on222ModeChange(() => setLocal(get222Type())), []);
  return [type, set222Type];
}
