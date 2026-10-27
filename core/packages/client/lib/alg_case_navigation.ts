import type { AlgCase } from '@cuberoot/shared';
import { primaryCaseName } from '@/lib/alg_case_display';
import { sortByCp } from '@/lib/alg_cp_order';
import { sortAlgItemsBySignedLabel } from '@/lib/alg_group_order';

/** Follow the list order within the case's most specific subgroup. */
export function adjacentAlgCases(puzzle: string, set: string, cases: AlgCase[], current: AlgCase) {
  const subgroup = (current.subgroup || '').toLowerCase();
  const ordered = sortAlgItemsBySignedLabel(sortByCp(set, cases), c => primaryCaseName(puzzle, set, c));
  const siblings = ordered.filter(c => (c.subgroup || '').toLowerCase() === subgroup);
  const index = siblings.findIndex(c => c.id != null && c.id === current.id);
  return {
    previous: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}
