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
import { CUBE222_STATE_TYPES, type Cube222StateType } from './cube222-metric';

export type Scramble222Mode = 'wca' | 'optimal';

export const SCRAMBLE_222_TYPES = [
  'full',
  '3gen',
  'eg',
  'cll',
  'eg1',
  'eg2',
  'tcllp',
  'tclln',
  'tcll',
  'ls',
  'nobar',
] as const;
export type Scramble222Type = (typeof SCRAMBLE_222_TYPES)[number];
/** WCA 真题可按最终状态精确判定的类型；3-gen 只描述生成过程，不能用于真题筛选。 */
export const WCA_SCRAMBLE_222_TYPES = ['full', ...CUBE222_STATE_TYPES] as const;

export function isCube222StateType(type: Scramble222Type): type is Cube222StateType {
  return CUBE222_STATE_TYPES.includes(type as Cube222StateType);
}

interface Scramble222TypeMeta {
  label: { zh: string; en: string };
  /** 空 = 完整状态,继续走本站 2x2 WCA / optimal 生成链。 */
  cstimer?: { key: string; length?: number };
}

const TYPE_META: Record<Scramble222Type, Scramble222TypeMeta> = {
  full:  { label: { zh: '完整状态', en: 'Full state' } },
  '3gen': { label: { zh: '三面随机转', en: '3-gen' }, cstimer: { key: '2223', length: 25 } },
  eg:    { label: { zh: 'EG', en: 'EG' }, cstimer: { key: '222eg' } },
  cll:   { label: { zh: 'CLL', en: 'CLL' }, cstimer: { key: '222eg0' } },
  eg1:   { label: { zh: 'EG1', en: 'EG1' }, cstimer: { key: '222eg1' } },
  eg2:   { label: { zh: 'EG2', en: 'EG2' }, cstimer: { key: '222eg2' } },
  tcllp: { label: { zh: 'TCLL+', en: 'TCLL+' }, cstimer: { key: '222tcp' } },
  tclln: { label: { zh: 'TCLL-', en: 'TCLL-' }, cstimer: { key: '222tcn' } },
  tcll:  { label: { zh: 'TCLL', en: 'TCLL' }, cstimer: { key: '222tc' } },
  ls:    { label: { zh: 'LS', en: 'LS' }, cstimer: { key: '222lsall' } },
  nobar: { label: { zh: '无连色', en: 'No Bar' }, cstimer: { key: '222nb' } },
};

const KEY = 'cuberoot.gen.222_mode';
const TYPE_KEY = 'cuberoot.gen.222_type';
const EVENT = 'cuberoot:222-mode-change';
const DEFAULT: Scramble222Mode = 'optimal';
const DEFAULT_TYPE: Scramble222Type = 'full';

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

export function get222Type(): Scramble222Type {
  if (typeof localStorage === 'undefined') return DEFAULT_TYPE;
  const stored = localStorage.getItem(TYPE_KEY);
  return SCRAMBLE_222_TYPES.includes(stored as Scramble222Type)
    ? stored as Scramble222Type
    : DEFAULT_TYPE;
}

export function set222Type(type: Scramble222Type): void {
  if (typeof localStorage === 'undefined') return;
  if (get222Type() === type) return;
  persistItem(TYPE_KEY, type);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function scramble222TypeLabel(key: string, isZh: boolean): string {
  const meta = TYPE_META[key as Scramble222Type] ?? TYPE_META.full;
  return isZh ? meta.label.zh : meta.label.en;
}

/** null 表示完整状态,由既有 WCA / optimal 引擎生成。 */
export function cstimer222Spec(type: Scramble222Type): Readonly<{ key: string; length?: number }> | null {
  return TYPE_META[type].cstimer ?? null;
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
