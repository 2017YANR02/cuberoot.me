import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { WebsiteStatistics } from './double-zbll-website-stats.mjs';
test('one minimum per pair, rotated/swapped pairs, fallback and PLL coverage stay separate', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'zbll-website-stats-'));
  try {
    const cases = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const hash = (s: Buffer) => createHash('sha256').update(s).digest('hex');
    const corpus = (dir: string, lengths: number[]) => {
      mkdirSync(dir, { recursive: true });
      const bytes = Buffer.alloc(84); lengths.forEach((n, i) => bytes[i * 21] = n);
      const c = Buffer.from(JSON.stringify({ cases }));
      writeFileSync(resolve(dir, 'pairs.bin'), bytes); writeFileSync(resolve(dir, 'cases.json'), c);
      writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify({ version: 'fixture', recordBytes: 21, pairCount: 4, caseCount: 2,
        dataFile: 'pairs.bin', casesFile: 'cases.json', dataSha256: hash(bytes), casesSha256: hash(c) }));
    };
    corpus(resolve(root, '.tmp/double-zbll-auf-full/export'), [18,17,16,15]);
    corpus(resolve(root, '.tmp/double-zbll-v1/export'), [18,18,18,18]);
    const s = new WebsiteStatistics(root, { N: 3, cases: [...cases, { id: 3, name: 'PLL' }],
      states: [{caseIndex:0},{caseIndex:1},{caseIndex:2}], image: (a,b,g) => g < 4 ? a*3+b : b*3+a });
    s.accept(1,14); s.accept(1,17); s.accept(1,14); s.accept(6,12);
    const result = s.summary();
    assert.equal(result.pairCount, 4); assert.equal(result.baselineMean,16.5); assert.equal(result.bestMean,15.25);
    assert.equal(result.improvedPairs,2); assert.equal(result.meanSaved,1.25); assert.equal(result.maxSaved,3);
    assert.equal(result.originalMean,18); assert.equal(result.pllKnownPairs,2); assert.equal(result.pllTotalPairs,5);
    assert.equal(result.histogram[14],2); assert.equal(result.histogram[15],1); assert.equal(result.histogram[18],1);
    assert.equal(result.histogram.reduce((a,b)=>a+b,0),4);
    assert.throws(()=>s.accept(9,12));
  } finally { rmSync(root,{recursive:true,force:true}); }
});
