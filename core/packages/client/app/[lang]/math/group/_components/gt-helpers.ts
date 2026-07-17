import { tr } from '@/i18n/tr';
import type { Lang } from './primitives';

// Small helpers shared by several §-sections' interactive demos.

/** Render a cycle-type multiset (e.g. [2,2,3]) as "2-cycle × 2-cycle × 3-cycle". */
export function formatCycle(cycles: number[], _lang: Lang): string {
  if (cycles.length === 0) return tr({ zh: '恒等 (无循环)', en: 'identity (no cycles)' });
  return cycles.map(c => `${c}-cycle`).join(' × ');
}

export type FaceLetterChar = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
