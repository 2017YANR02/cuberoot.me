// Ported from packages/client/src/utils/trainerCaseKey.ts
import type { AlgCase } from '@cuberoot/shared';

export function caseKey(c: { subgroup: string; name: string }): string {
  return `${c.subgroup}|${c.name}`;
}

export function findCaseByKey(cases: AlgCase[], key: string): AlgCase | undefined {
  return cases.find(c => caseKey(c) === key);
}
