import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { splitExampleSet, type ExampleSet, type ExampleShard } from '../src/build_example_shards';

const root = resolve(import.meta.dirname, '../../../../stats/scramble');
const read = (file: string) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
const distribution = read('distribution.json');
const original = read('examples.json');

describe('committed scramble preview shards preserve every sample', () => {
  for (const [setKey, variants] of Object.entries(distribution.meta.example_shards) as Array<[string, Record<string, Record<string, string>>]>) {
    it(`reconstructs all colors, bins, and sample metadata for ${setKey}`, () => {
      const source: ExampleSet = distribution.sets[setKey].event ? read(`examples_${setKey}.json`) : original.sets[setKey];
      const reconstructed: ExampleSet['variants'] = {};
      const generated = splitExampleSet(source);
      expect(Object.values(variants).reduce((n, stages) => n + Object.keys(stages).length, 0)).toBe(generated.length);
      for (const { variant, stage, shard: expected } of generated) {
        const url = variants[variant][stage];
        const shard: ExampleShard = read(url.split('?')[0]);
        expect(shard).toEqual(expected);
        const { meta, ...payload } = shard;
        expect(new URLSearchParams(url.split('?')[1]).get('v')).toBe(meta.content_hash);
        expect(createHash('sha256').update(JSON.stringify(payload)).digest('hex')).toBe(meta.content_hash);
        (reconstructed[variant] ??= {})[stage] = shard.variants[variant][stage];
        for (const bins of Object.values(shard.variants[variant][stage])) for (const samples of Object.values(bins)) {
          for (const [id] of samples) {
            expect(shard.idMeta?.[id]).toEqual(source.idMeta?.[id]);
            const compId = source.idMeta?.[id]?.[0];
            if (compId) expect(shard.comps?.[compId]).toEqual(source.comps?.[compId]);
          }
        }
      }
      expect(reconstructed).toEqual(source.variants);
    });
  }

  it('indexes every source dataset with previews', () => {
    const expected = Object.keys(distribution.sets).filter(key => distribution.sets[key].event || original.sets[key]);
    expect(Object.keys(distribution.meta.example_shards).sort()).toEqual(expected.sort());
  });
});

// Run only the tiny injection step against one synthetic solved row, never the solver.
it('standalone optimal-result injection invalidates only the changed preview pointers', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cuberoot-preview-inject-'));
  try {
    const sourceDir = resolve(root, '../../solver/333opt');
    for (const file of ['inject.mjs', 'data_paths.mjs']) copyFileSync(resolve(sourceDir, file), resolve(dir, file));
    const dist = { meta: { example_shards: { wca: { '333': { '333': 'old' }, std: { '333': 'obsolete', cross: 'keep' } } } }, sets: { wca: { variants: { std: { stages: ['cross', '333'], data: { cross: {}, '333': {} } } } } } };
    writeFileSync(resolve(dir, 'dist.json'), JSON.stringify(dist));
    writeFileSync(resolve(dir, 'examples.json'), JSON.stringify({ sets: { wca: { variants: {} } } }));
    writeFileSync(resolve(dir, 'out.0.csv'), 'id,htm,solution\n1,1,R\n');
    writeFileSync(resolve(dir, 'corpus.txt'), '1,R\n');
    execFileSync(process.execPath, [resolve(dir, 'inject.mjs')], {
      timeout: 5000,
      maxBuffer: 64 * 1024,
      cwd: dir,
      shell: false,
      env: { ...process.env, DIST: resolve(dir, 'dist.json'), EX: resolve(dir, 'examples.json'), CORPUS: resolve(dir, 'corpus.txt'), META: resolve(dir, 'absent.csv'), COMPS: resolve(dir, 'absent.tsv') },
    });
    const updated = JSON.parse(readFileSync(resolve(dir, 'dist.json'), 'utf8'));
    expect(updated.meta.example_shards.wca).toEqual({ std: { cross: 'keep' } });
    expect(updated.sets.wca.variants['333'].sample_count).toBe(1);
    const examples = JSON.parse(readFileSync(resolve(dir, 'examples.json'), 'utf8'));
    expect(examples.sets.wca.variants['333']['333'].ALL['1']).toEqual([['1', 'R', '', "R'"]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
