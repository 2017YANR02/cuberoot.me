import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { aggregateVariant } from '../src/build';
import { VARIANTS } from '../src/variants';

it('preserves all histograms, country/event buckets and seeded reservoirs byte-for-byte', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stage-aggregate-'));
  try {
    const spec = VARIANTS[0];
    const angles = ['z0', 'z2', 'z3', 'z1', 'x3', 'x1'];
    const rows = [['id', ...spec.stages.flatMap(s => angles.map(a => spec.colFor(s, a)))].join(',')];
    const scrambles = new Map<string, string>();
    const events = new Map<string, string>();
    const countries = new Map<string, string>();
    // Exceed both reservoir limits and TOP_COUNTRIES_DIST; include tied minima,
    // absent metadata/scrambles, malformed stage cells, CRLF and empty lines.
    for (let i = 0; i < 4200; i++) {
      const id = String(i + 1);
      const values = Array.from({ length: 30 }, (_, c) => String((Math.floor(i / 7) + c * 3) % 9));
      if (i % 421 === 0) values[2] = 'NaN';
      if (i % 509 === 0) values[8] = '';
      rows.push([id, ...values].join(','));
      if (i % 97 === 0) rows.push('');
      if (i % 17 !== 0) scrambles.set(id, 'R U F2');
      if (i % 19 !== 0) events.set(id, ['333', '333oh', '333bf'][i % 3]);
      if (i % 23 !== 0) countries.set(id, `Country${i % 21}`);
    }
    const file = join(dir, 'std.csv');
    await writeFile(file, rows.join('\r\n'));
    const output = await aggregateVariant(spec, file, scrambles, events, countries);
    // Captured from the pre-optimization implementation, including selected
    // example IDs/colors and ordering. Do not refresh to mask a sampling change.
    expect(createHash('sha256').update(JSON.stringify(output)).digest('hex'))
      .toBe('7d1f1462cc07b4618e048b512e305cebc83f3b8c1c9415fa4aec10627701ab7f');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
