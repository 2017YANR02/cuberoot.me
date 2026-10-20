import type { AlgCase } from '@cuberoot/shared/alg';

export interface AlgTopGroup {
  label: string;
  subs: Map<string, AlgCase[]>;
  allCases: AlgCase[];
  sample: AlgCase;
}

/** Shared library/trainer hierarchy: orientation → COLL subgroup → cases for ZBLL.
 * Preserve source order, full subgroup paths and original case objects. */
export function groupAlgCases(cases: readonly AlgCase[]) {
  const map = new Map<string, AlgTopGroup>();
  let hasSub = false;
  for (const c of cases) {
    const parts = (c.subgroup || '').split('/');
    const top = parts[0] || '';
    const sub = parts.slice(1).join('/');
    if (sub) hasSub = true;
    let g = map.get(top);
    if (!g) {
      g = { label: top, subs: new Map(), allCases: [], sample: c };
      map.set(top, g);
    }
    g.allCases.push(c);
    const arr = g.subs.get(sub) ?? [];
    arr.push(c);
    g.subs.set(sub, arr);
  }
  return { tops: Array.from(map.values()), hasSubLevel: hasSub };
}
