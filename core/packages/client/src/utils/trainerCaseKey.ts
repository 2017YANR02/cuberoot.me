/**
 * Canonical key for an AlgCase in the trainer store.
 *
 * `case.name` alone is NOT unique — F2L Adv has cases named "EO" / "Line" /
 * "VP" repeated across subgroups A+, A-, B+, B-. The same name in a different
 * subgroup is a different case (different sticker / setup / algs).
 *
 * Use `${subgroup}|${name}` as the selection / persistence / lookup key.
 * Display still uses `name`.
 */
import type { AlgCase } from '@cuberoot/shared';

export function caseKey(c: { subgroup: string; name: string }): string {
  return `${c.subgroup}|${c.name}`;
}

export function findCaseByKey(cases: AlgCase[], key: string): AlgCase | undefined {
  return cases.find(c => caseKey(c) === key);
}
