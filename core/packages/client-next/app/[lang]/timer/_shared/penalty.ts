/**
 * Penalty casing bridge — Solo timer and 1v1 Battle diverge on casing.
 *
 *   - Timer (canonical):  'ok' | '+2' | 'DNF'   (uppercase DNF)
 *   - Battle (legacy):     'ok' | '+2' | 'dnf'   (lowercase dnf)
 *
 * Battle's persisted `solveHistory` was written with lowercase 'dnf', so we
 * keep round-trippable adapters instead of rewriting old data:
 *   - normalizePenalty  : any battle/timer string -> canonical Penalty (read)
 *   - toBattlePenalty   : canonical Penalty -> battle's lowercase string (write)
 *
 * Pure functions only — no React, no DOM, safe to import anywhere.
 */

// Canonical uppercase penalty type. Aliases timer's own definition so there is
// a single source of truth; importers should use this re-export.
export type { Penalty } from '../_lib/types';
import type { Penalty } from '../_lib/types';

/**
 * Read adapter — coerce any stored penalty string into the canonical type.
 * 'dnf'/'DNF' -> 'DNF', '+2' -> '+2', everything else (incl. null/undefined,
 * 'ok', unknown) -> 'ok'. Case-insensitive on the DNF token.
 */
export function normalizePenalty(p: string | null | undefined): Penalty {
  if (p == null) return 'ok';
  const s = p.trim();
  if (s.toLowerCase() === 'dnf') return 'DNF';
  if (s === '+2') return '+2';
  return 'ok';
}

/**
 * Write adapter — emit the casing battle's history format expects.
 * 'DNF' -> 'dnf'; '+2' and 'ok' pass through unchanged.
 */
export function toBattlePenalty(p: Penalty): string {
  return p === 'DNF' ? 'dnf' : p;
}
