import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSq1Tokens } from '@cuberoot/shared/sq1-notation';

export type UpstreamAlgMeta = { note?: string };
export type UpstreamCase = { subset: string; algs: Record<string, UpstreamAlgMeta> };
export type UpstreamSet = { cases: Record<string, UpstreamCase> };

const NOTE_ZH: Record<string, string> = {
  'Basically just an M2': '基本就是 M2',
  "M2 U' D M2": "M2 U' D M2",
  'Fastest alg': '最快公式',
  'Preserves CP': '保持 CP',
};

export function invariant(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

export function readCubingAppSq1Set(upstreamRoot: string, file: string): UpstreamSet {
  const path = resolve(upstreamRoot, 'tanstack/src/routes/algorithms/algs', `${file}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as UpstreamSet;
}

export function normalizeSubgroup(value: string): string {
  return value === '1 Slash' ? '1 Slice' : value.replace(/ Slashes$/, ' Slices');
}

export function sourceAlgs(source: UpstreamCase) {
  const entries = Object.entries(source.algs);
  invariant(entries.length > 0, `case in ${source.subset} has no algorithms`);
  return [entries.map(([alg, meta]) => {
    invariant(parseSq1Tokens(alg).length > 0, `unparseable SQ1 algorithm: ${alg}`);
    if (!meta.note) return { alg, source: 'cubingapp' as const };
    const zh = NOTE_ZH[meta.note];
    invariant(zh, `missing Chinese translation for CubingApp note: ${meta.note}`);
    return { alg, source: 'cubingapp' as const, note: { en: meta.note, zh } };
  })];
}

export function upstreamCase(set: UpstreamSet, name: string): UpstreamCase {
  const found = set.cases[name];
  invariant(found, `missing upstream case: ${name}`);
  return found;
}
