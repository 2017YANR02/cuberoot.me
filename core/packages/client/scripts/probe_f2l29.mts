import db from '../../shared/data/algdb_f2l.json' with { type: 'json' };
for (const c of (db as { cases: Array<{ name: string; algs: Array<Array<{ alg: string }>> }> }).cases) {
  if (c.name === 'F2L 29') {
    console.log('F2L 29 algs by ori:');
    for (let i = 0; i < 4; i++) {
      console.log(`  ori=${i}:`);
      for (const v of (c.algs[i] ?? []).slice(0, 6)) console.log(`    ${v.alg}`);
    }
  }
}
