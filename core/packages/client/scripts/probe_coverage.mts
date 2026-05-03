import f2l from '../../shared/data/algdb_3x3_f2l.json' with { type: 'json' };
import oll from '../../shared/data/algdb_3x3_oll.json' with { type: 'json' };
import pll from '../../shared/data/algdb_3x3_pll.json' with { type: 'json' };
function ftOnly(a: string) {
  return a.split(/\s+/).filter(Boolean).every(t => /^[UDFBLR]['2]?$/.test(t));
}
for (const [name, db] of [['F2L', f2l], ['OLL', oll], ['PLL', pll]] as const) {
  const cases = (db as { cases: Array<{ name: string; algs: Array<Array<{ alg: string }>> }>}).cases;
  let total = 0, withFt = 0;
  for (const c of cases) {
    for (const variants of c.algs) {
      if (variants?.length) {
        total++;
        if (variants.some(v => v.alg && ftOnly(v.alg))) withFt++;
      }
    }
  }
  console.log(`${name}: ${withFt}/${total} ori-slots have a face-turn-only alg`);
}
