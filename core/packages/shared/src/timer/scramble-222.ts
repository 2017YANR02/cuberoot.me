/**
 * Runtime-neutral 2x2 scramble contract shared by Web, Android, and iOS.
 *
 * Hosts own persistence and generation. This module is the single source for
 * selectable modes/types, bilingual labels, WCA-filter eligibility, and the
 * vendored csTimer scrambler specs.
 */

export const SCRAMBLE_222_MODES = ['wca', 'optimal'] as const;
export type Scramble222Mode = (typeof SCRAMBLE_222_MODES)[number];

export const DEFAULT_SCRAMBLE_222_MODE: Scramble222Mode = 'optimal';

export interface Scramble222CstimerSpec {
  key: string;
  length?: number;
}

export interface Scramble222BilingualText {
  en: string;
  zh: string;
}

export const SCRAMBLE_222_UI_LABELS = {
  modeAriaLabel: { zh: '2x2 打乱口径', en: '2x2 scramble style' },
  modeLabel: { zh: '口径', en: 'style' },
  optimal: { zh: '最优', en: 'Optimal' },
  type: { zh: '类型', en: 'Type' },
  typeAriaLabel: { zh: '2x2 打乱类型', en: '2x2 scramble type' },
  wca11Move: { zh: 'WCA 11 步', en: 'WCA 11-move' },
} as const satisfies Readonly<Record<string, Scramble222BilingualText>>;

export interface Scramble222TypeCatalogItem {
  id: string;
  label: Readonly<Scramble222BilingualText>;
  /** 3-gen describes a generation process, so it cannot filter real WCA states. */
  wcaStateType: boolean;
  /** Missing for full-state generation, which stays on the host's WCA/optimal engine. */
  cstimer?: Readonly<Scramble222CstimerSpec>;
}

export const SCRAMBLE_222_TYPE_CATALOG = [
  { id: 'full', label: { zh: '完整状态', en: 'Full state' }, wcaStateType: false },
  { id: '3gen', label: { zh: '三面随机转', en: '3-gen' }, wcaStateType: false, cstimer: { key: '2223', length: 25 } },
  { id: 'eg', label: { zh: 'EG', en: 'EG' }, wcaStateType: true, cstimer: { key: '222eg' } },
  { id: 'cll', label: { zh: 'CLL', en: 'CLL' }, wcaStateType: true, cstimer: { key: '222eg0' } },
  { id: 'eg1', label: { zh: 'EG1', en: 'EG1' }, wcaStateType: true, cstimer: { key: '222eg1' } },
  { id: 'eg2', label: { zh: 'EG2', en: 'EG2' }, wcaStateType: true, cstimer: { key: '222eg2' } },
  { id: 'tcllp', label: { zh: 'TCLL+', en: 'TCLL+' }, wcaStateType: true, cstimer: { key: '222tcp' } },
  { id: 'tclln', label: { zh: 'TCLL-', en: 'TCLL-' }, wcaStateType: true, cstimer: { key: '222tcn' } },
  { id: 'tcll', label: { zh: 'TCLL', en: 'TCLL' }, wcaStateType: true, cstimer: { key: '222tc' } },
  { id: 'ls', label: { zh: 'LS', en: 'LS' }, wcaStateType: true, cstimer: { key: '222lsall' } },
  { id: 'nobar', label: { zh: '无连色', en: 'No Bar' }, wcaStateType: true, cstimer: { key: '222nb' } },
] as const satisfies readonly Scramble222TypeCatalogItem[];

export type Scramble222Type = (typeof SCRAMBLE_222_TYPE_CATALOG)[number]['id'];
export type Scramble222WcaStateType = Exclude<Scramble222Type, 'full' | '3gen'>;

export const SCRAMBLE_222_TYPES: readonly Scramble222Type[] = SCRAMBLE_222_TYPE_CATALOG.map(
  ({ id }) => id,
);

export const WCA_SCRAMBLE_222_TYPES: readonly Scramble222Type[] = SCRAMBLE_222_TYPE_CATALOG
  .filter(({ id, wcaStateType }) => id === 'full' || wcaStateType)
  .map(({ id }) => id);

export const DEFAULT_SCRAMBLE_222_TYPE: Scramble222Type = 'full';

type CatalogItem = Scramble222TypeCatalogItem & { id: Scramble222Type };

const TYPE_BY_ID = new Map<Scramble222Type, CatalogItem>(
  SCRAMBLE_222_TYPE_CATALOG.map((item) => [item.id, item as CatalogItem]),
);

export function isScramble222Mode(value: unknown): value is Scramble222Mode {
  return typeof value === 'string' && SCRAMBLE_222_MODES.includes(value as Scramble222Mode);
}

export function isScramble222Type(value: unknown): value is Scramble222Type {
  return typeof value === 'string' && TYPE_BY_ID.has(value as Scramble222Type);
}

export function isCube222StateType(type: Scramble222Type): type is Scramble222WcaStateType {
  return TYPE_BY_ID.get(type)?.wcaStateType === true;
}

export function scramble222TypeLabels(type: string): Readonly<Scramble222BilingualText> {
  return TYPE_BY_ID.get(type as Scramble222Type)?.label
    ?? TYPE_BY_ID.get(DEFAULT_SCRAMBLE_222_TYPE)!.label;
}

/** `null` means full-state generation through the host's WCA/optimal engine. */
export function cstimer222Spec(type: Scramble222Type): Readonly<Scramble222CstimerSpec> | null {
  return TYPE_BY_ID.get(type)?.cstimer ?? null;
}
