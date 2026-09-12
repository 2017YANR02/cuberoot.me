/** Plan-only maintenance tool: tsx scripts/sq1-ep-correct.ts INPUT.json OUTPUT.json. */
import { readFileSync, writeFileSync } from 'node:fs';
import type { AlgCase, AlgEntry, AlgFile } from '@cuberoot/shared/alg';
import { applySq1Scramble, invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import { displayAlgCaseName } from '@cuberoot/shared/recon/alg-case-display';
import { classifySq1EpState } from '../lib/sq1-ep-parity';
import { traceSq1Algorithm } from '../lib/sq1-tools';

const solved = JSON.stringify(applySq1Scramble(''));
const nameKey = (name: string) => name.split(/\s*[&/]\s*/).join('|');
function actualKey(setup: string): string {
  const labels = classifySq1EpState(applySq1Scramble(setup));
  if (!labels) throw new Error(`Not an EP state: ${setup}`);
  return labels.join('|');
}
function verifyEntry(entry: AlgEntry, setup: string, expected?: string) {
  const trace = traceSq1Algorithm(entry.alg, setup);
  if (!trace.ok || JSON.stringify(trace.steps.at(-1)?.state) !== solved) {
    throw new Error(`Invalid or unsolved formula: ${entry.alg}`);
  }
  const actual = actualKey(setup);
  if (expected && actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
  return actual;
}

export function planSq1EpCorrection(input: AlgFile) {
  if (input.puzzle !== 'sq1' || input.set !== 'ep' || input.cases.length !== 100) throw new Error('Expected full 100-case SQ1 EP snapshot');
  const targets = new Map(input.cases.map(c => [nameKey(c.name), c]));
  if (targets.size !== 100 || new Set(input.cases.map(c => c.id)).size !== 100) throw new Error('Duplicate case identity');
  if (input.cases.some(c => c.algs.length !== 1 || c.oriNames || c.standard || c.mirrorCaseId)) throw new Error('Unexpected orientation or standard/mirror metadata; review manually');
  const grouped = new Map<string, AlgEntry[]>([...targets.keys()].map(key => [key, []]));
  const moves: { from: number; to: number; fromName: string; toName: string; index: number; alg: string }[] = [];
  const incoming: { key: string; entry: AlgEntry }[] = [];
  for (const c of input.cases) {
    const setupTrace = traceSq1Algorithm('', c.setup);
    if (!setupTrace.ok) throw new Error(`Invalid representative setup: ${c.id}`);
    for (const [index, entry] of c.algs[0].entries()) {
      const setup = entry.setup ?? c.setup;
      const key = verifyEntry(entry, setup);
      const target = targets.get(key);
      if (!target) throw new Error(`No target for ${key}`);
      // Preserve every original field, including altId, notes and provenance.
      const completeEntry = entry.setup === undefined ? { ...entry, setup } : entry;
      if (target.id === c.id) grouped.get(key)!.push(completeEntry);
      else {
        incoming.push({ key, entry: completeEntry });
        moves.push({ from: c.id!, to: target.id!, fromName: c.name, toName: target.name, index, alg: entry.alg });
      }
    }
  }
  for (const { key, entry } of incoming) grouped.get(key)!.push(entry);
  const derived: { target: number; source: number; sourceName: string; alg: string }[] = [];
  for (const [key, entries] of grouped) {
    if (key === 'Solved|Solved' || entries.length) continue;
    let found: AlgEntry | undefined;
    for (const source of input.cases) {
      for (const entry of source.algs[0]) {
        if (actualKey(entry.alg) !== key) continue;
        const sourceName = displayAlgCaseName('sq1', 'ep', actualKey(entry.setup ?? source.setup).replace('|', ' / '));
        found = {
          alg: invertSq1Alg(entry.alg), setup: entry.alg, source: 'cuberoot',
          note: {
            zh: `由 ${sourceName} 的公式取逆得到；原公式来源：${entry.source ?? '未标注'}。`,
            en: `Inverse of a ${sourceName} formula; original source: ${entry.source ?? 'unspecified'}.`,
          },
        };
        verifyEntry(found, found.setup!, key);
        derived.push({ target: targets.get(key)!.id!, source: source.id!, sourceName: source.name, alg: entry.alg });
        break;
      }
      if (found) break;
    }
    if (!found) throw new Error(`No validated inverse formula for ${key}`);
    entries.push(found);
  }
  const cases = input.cases.map(c => {
    const key = nameKey(c.name);
    const entries = grouped.get(key)!;
    const setup = entries.length ? entries[0].setup! : '';
    if (actualKey(setup) !== key) throw new Error(`Incorrect representative for ${c.name}`);
    for (const entry of entries) verifyEntry(entry, entry.setup!, key);
    // Keep catalog identities (including legacy subgroup keys) used by progress
    // and submissions. EP's visible groups already derive from the case name.
    return { ...c, setup, algs: [entries] } satisfies AlgCase;
  });
  const changed = cases.filter((c, i) => JSON.stringify(c) !== JSON.stringify(input.cases[i]));
  return {
    before: input,
    after: { ...input, cases },
    moves, derived, changedIds: changed.map(c => c.id),
    counts: { cases: cases.length, before: input.cases.flatMap(c => c.algs.flat()).length, after: cases.flatMap(c => c.algs.flat()).length },
  };
}

if (typeof require !== 'undefined' && require.main === module) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error('Usage: sq1-ep-correct.ts INPUT.json OUTPUT.json');
  const plan = planSq1EpCorrection(JSON.parse(readFileSync(inputPath, 'utf8')));
  writeFileSync(outputPath, JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify({ counts: plan.counts, moves: plan.moves.length, derived: plan.derived, changedIds: plan.changedIds }, null, 2));
}
