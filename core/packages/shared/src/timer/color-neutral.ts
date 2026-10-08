/**
 * Training color neutrality: keep one bottom (4 orientations), either of two
 * opposite bottoms (8), or any bottom (24), matching csTimer's scrNeut groups.
 * Rewrite moves in the fixed center frame instead of adding a regrip prefix.
 */
import type { EventId } from './types';
import { CUBE_ORIENTATIONS } from './cube-orientation';
import { isTrainingEvent } from './pre-scramble';
import { normalizeWcaScramble } from '../normalize_wca_scramble';

export type CnMode = 'none' | 'single' | 'dual' | 'six';

export function normalizeTimerColorNeutralMode(value: unknown): CnMode {
  return value === 'single' || value === 'dual' || value === 'six' ? value : 'none';
}

const ROTATIONS = {
  none: [''],
  single: CUBE_ORIENTATIONS.slice(0, 4).map(({ value }) => value),
  dual: CUBE_ORIENTATIONS.slice(0, 8).map(({ value }) => value),
  six: CUBE_ORIENTATIONS.map(({ value }) => value),
} satisfies Record<CnMode, readonly string[]>;

export function timerColorNeutralOrientations(mode: CnMode): readonly string[] {
  return ROTATIONS[mode];
}

export function isCnEligible(event: EventId): boolean {
  // csTimer's Roux state generators do not support scrNeut either.
  return isTrainingEvent(event) && event !== 'lse' && event !== 'l10p';
}

export function applyColorNeutral(
  scramble: string,
  mode: CnMode,
  rng: () => number = Math.random,
): string {
  if (mode === 'none') return scramble;
  const pool = timerColorNeutralOrientations(mode);
  const pick = pool[Math.floor(rng() * pool.length)] ?? '';
  const transformed = normalizeWcaScramble(`${pick} ${scramble}`);
  if (transformed === null) throw new Error('Invalid color-neutral training scramble');
  return transformed;
}
