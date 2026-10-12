/** Website view: one shortest known verified scramble per ordered case pair. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

interface Model {
  N: number; cases: { id: number; name: string }[]; states: { caseIndex: number }[];
  image(a: number, b: number, g: number): number;
}
export interface WebsiteSummary {
  pairCount: number; baselineMean: number; bestMean: number; originalMean: number;
  improvedPairs: number; meanSaved: number; maxSaved: number; histogram: number[];
  pllKnownPairs: number; pllTotalPairs: number; baselineVersion: string;
}
export class WebsiteStatistics {
  private best: Uint8Array;
  private baseline: Uint8Array;
  private original: Uint8Array;
  private count: number;
  private version: string;
  private cached?: WebsiteSummary;
  constructor(root: string, private model: Model) {
    const load = (dir: string) => {
      const m = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
      const bytes = readFileSync(resolve(dir, m.dataFile));
      const cases = readFileSync(resolve(dir, m.casesFile));
      if (m.recordBytes !== 21 || m.pairCount !== m.caseCount ** 2 || bytes.length !== m.pairCount * 21
        || createHash('sha256').update(bytes).digest('hex') !== m.dataSha256
        || createHash('sha256').update(cases).digest('hex') !== m.casesSha256) throw Error('网站导出题库完整性校验失败');
      const rows = JSON.parse(cases.toString()).cases;
      if (rows.length !== m.caseCount || rows.some((c: any, i: number) => c.id !== model.cases[i]?.id || c.name !== model.cases[i]?.name)) throw Error('网站 case 顺序不一致');
      const lengths = Uint8Array.from({ length: m.pairCount }, (_, i) => bytes[i * 21]);
      if (lengths.some(n => n < 1 || n > 20)) throw Error('网站题库步数异常');
      return { m, lengths };
    };
    // Read producer artifacts, never depend on client source/public assets.
    const current = load(resolve(root, '.tmp/double-zbll-auf-full/export'));
    const original = load(resolve(root, '.tmp/double-zbll-v1/export'));
    if (current.m.caseCount !== original.m.caseCount) throw Error('网站基线范围已变化，需要重新核对统计');
    this.count = current.m.caseCount; this.version = current.m.version;
    this.baseline = current.lengths; this.original = original.lengths;
    this.best = new Uint8Array(model.cases.length ** 2);
    for (let a = 0; a < this.count; a++) for (let b = 0; b < this.count; b++) {
      this.best[a * model.cases.length + b] = this.baseline[a * this.count + b];
    }
  }
  accept(id: number, length: number) {
    if (!Number.isSafeInteger(id) || id < 0 || id >= this.model.N ** 2 || !Number.isInteger(length) || length < 1 || length > 20) throw Error('统计记录非法');
    const a = Math.floor(id / this.model.N), b = id % this.model.N;
    for (let g = 0; g < 8; g++) {
      const mapped = this.model.image(a, b, g);
      const top = this.model.states[Math.floor(mapped / this.model.N)].caseIndex;
      const bottom = this.model.states[mapped % this.model.N].caseIndex;
      const pair = top * this.model.cases.length + bottom;
      if (!this.best[pair] || length < this.best[pair]) { this.best[pair] = length; this.cached = undefined; }
    }
  }
  pairBaseline(top: number, bottom: number): number | null {
    return top < this.count && bottom < this.count ? this.baseline[top * this.count + bottom] : null;
  }
  summary(): WebsiteSummary {
    if (this.cached) return this.cached;
    const histogram = Array<number>(21).fill(0);
    let sum = 0, baselineSum = 0, originalSum = 0, improvedPairs = 0, maxSaved = 0, pllKnownPairs = 0;
    const n = this.model.cases.length;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const best = this.best[a * n + b];
      if (a >= this.count || b >= this.count) { if (best) pllKnownPairs++; continue; }
      const old = this.baseline[a * this.count + b];
      sum += best; baselineSum += old; originalSum += this.original[a * this.count + b]; histogram[best]++;
      if (best < old) improvedPairs++;
      maxSaved = Math.max(maxSaved, old - best);
    }
    const pairCount = this.count ** 2;
    return this.cached = { pairCount, histogram, baselineMean: baselineSum / pairCount, bestMean: sum / pairCount,
      originalMean: originalSum / pairCount, meanSaved: (baselineSum - sum) / pairCount,
      improvedPairs, maxSaved, pllKnownPairs, pllTotalPairs: n * n - pairCount, baselineVersion: this.version };
  }
}
