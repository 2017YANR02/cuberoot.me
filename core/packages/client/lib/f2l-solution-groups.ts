import type { AlgCase, AlgEntry } from '@cuberoot/shared/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { duplicateAlgKey, invertMoveString, toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { getCube3 } from '@/lib/cube3';
import { commonCaseSetup } from '@/lib/alg_case_alignment';
import { simplifyAdjacentU } from '@/lib/alg_display';

export interface F2lInsertion {
  alg: string;
  fullAlg: string;
  source: 'standard' | 'original';
}
export interface F2lSolutionGroup {
  key: string;
  prefix: string;
  standardName: string;
  standardId?: number;
  orientation: number;
  options: F2lInsertion[];
  sourceIndices: number[];
}
export interface F2lGroupedSolutions {
  groups: F2lSolutionGroup[];
  ungrouped: number[];
}

/** The existing four Free Pairs cases are the insertion library, not copies of
 * their algorithms. Names/IDs/formulas stay owned by the current API snapshot. */
export function isF2lStandard(c: AlgCase): boolean {
  return c.subgroup === 'Free Pairs';
}

/** Track all lower-layer pieces wherever they are, plus the holding frame.
 * Last-layer permutation/orientation is intentionally unconstrained for F2L.
 * Matching only the target pair would allow breaking the cross/other slots. */
export function f2lStateKey(pattern: KPattern): string {
  return ['CORNERS', 'EDGES'].map(name => {
    const orbit = pattern.patternData[name];
    return orbit.pieces.map((piece, position) => piece >= 4
      ? `${piece}:${position}:${orbit.orientation[position]}` : '')
      .filter(Boolean).sort().join(',');
  }).concat(pattern.patternData.CENTERS.pieces.join(',')).join('|');
}

/** Derive references from every existing full algorithm. Standard-library
 * choices update on the next read; distinct legacy suffixes remain explicitly
 * marked as originals, never mistaken for a live standard reference. */
export async function groupF2lSolutions(
  cases: readonly AlgCase[], setup: string, entries: readonly AlgEntry[], orientation: number,
): Promise<F2lGroupedSolutions> {
  const solved = (await getCube3()).defaultPattern();
  const solvedKey = f2lStateKey(solved);
  const start = solved.applyAlg(toMoveStringStrict(setup));
  const standards = new Map<string, Array<{ c: AlgCase; auf: string }>>();
  for (const c of cases.filter(isF2lStandard)) {
    try {
      const base = solved.applyAlg(toMoveStringStrict(commonCaseSetup('3x3', 'f2l', c, orientation)));
      for (const auf of ['', 'U', 'U2', "U'"]) {
        const key = f2lStateKey(base.applyAlg(auf));
        standards.set(key, [...(standards.get(key) ?? []), { c, auf }]);
      }
    } catch { /* An invalid standard must not hide any source rows. */ }
  }
  const groups = new Map<string, F2lSolutionGroup>();
  const ungrouped: number[] = [];
  const retainOriginal = (group: F2lSolutionGroup, suffix: string) => {
    const alg = simplifyAdjacentU('3x3', suffix);
    if (!group.options.some(option => duplicateAlgKey(option.alg) === duplicateAlgKey(alg))) {
      group.options.push({ alg, fullAlg: `${group.prefix} ${alg}`, source: 'original' });
    }
  };
  entries.forEach((entry, sourceIndex) => {
    try {
      const moves = toMoveStringStrict(entry.alg).split(/\s+/).filter(Boolean);
      // Keep invalid originals visible for correction. Never turn one into a
      // valid-looking composition by silently replacing its broken suffix.
      if (f2lStateKey(start.applyAlg(moves.join(' '))) !== solvedKey) {
        ungrouped.push(sourceIndex); return;
      }
      let state = start;
      for (let split = 1; split < moves.length; split++) {
        state = state.applyAlg(moves[split - 1]);
        for (const { c, auf } of standards.get(f2lStateKey(state)) ?? []) {
          const prefix = moves.slice(0, split).join(' ');
          const key = `${prefix}|${c.id ?? c.name}|${orientation}|${auf}`;
          const existing = groups.get(key);
          if (existing) {
            existing.sourceIndices.push(sourceIndex);
            retainOriginal(existing, moves.slice(split).join(' '));
            return;
          }
          const options: F2lInsertion[] = [];
          const seen = new Set<string>();
          for (const insertion of c.algs[orientation] ?? []) {
            try {
              const alg = simplifyAdjacentU('3x3', [invertMoveString(auf), toMoveStringStrict(insertion.alg)].filter(Boolean).join(' '));
              if (seen.has(alg) || f2lStateKey(state.applyAlg(alg)) !== solvedKey) continue;
              seen.add(alg);
              options.push({ alg, fullAlg: `${prefix} ${alg}`, source: 'standard' });
            } catch { /* Unusable library choices are not offered. */ }
          }
          if (!options.length) continue;
          const group = { key, prefix, standardName: c.name, standardId: c.id,
            orientation, options, sourceIndices: [sourceIndex] };
          retainOriginal(group, moves.slice(split).join(' '));
          groups.set(key, group);
          return;
        }
      }
    } catch { /* Unsupported notation remains in the original list. */ }
    ungrouped.push(sourceIndex);
  });
  return { groups: [...groups.values()], ungrouped };
}
