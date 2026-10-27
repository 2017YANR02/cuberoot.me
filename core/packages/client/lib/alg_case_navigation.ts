import type { AlgCase } from '@cuberoot/shared/alg';
import { primaryCaseName } from '@/lib/alg_case_display';
import { sortByCp } from '@/lib/alg_cp_order';
import { sortAlgItemsBySignedLabel } from '@/lib/alg_group_order';
import { algCaseHref } from '@/lib/alg_case_link';

/** Follow the owning list, including its text-only subgroup sections. */
export function adjacentAlgCases(puzzle: string, set: string, cases: AlgCase[], current: AlgCase) {
  const listPath = (c: AlgCase) => algCaseHref(puzzle, set, c).split('#')[0];
  const parent = listPath(current);
  const ordered = sortAlgItemsBySignedLabel(sortByCp(set, cases), c => primaryCaseName(puzzle, set, c));
  const siblings = ordered.filter(c => listPath(c) === parent);
  const index = siblings.findIndex(c => c.id != null && c.id === current.id);
  return {
    previous: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}
