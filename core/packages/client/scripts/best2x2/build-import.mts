/**
 * derived-site.json + 站内 2x2 快照 → 确定性导入清单。
 *
 * 现有 case 保留 name/subgroup/sticker(用户进度键不变),表格公式先对齐到该格标准题面;
 * 新 case 使用表格分组名。校验失败的来源分支只进 quarantine,绝不混入可训练公式。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { alignAlgToState } from './derive.mts';
const { faceletToPocketState } = await import('../../lib/pocket-facelet.ts');

const ROOT = resolve(import.meta.dirname, '../../../../..');
const input = resolve(ROOT, process.argv[2] ?? '.tmp/best2x2/derived-site.json');
const siteDir = resolve(ROOT, process.argv[3] ?? '.tmp/best2x2');
const output = resolve(ROOT, process.argv[4] ?? '.tmp/best2x2/import.json');
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1OFXakCV85Mp2zsQBXMxiMX9a506JeAcLnUXZr8FgXAY/edit';

interface DerivedAlg {
  alg: string; alignedAlg: string | null; raw: string; row: number; ok: boolean;
  choices: string[]; variant: number; variants: number;
}
interface DerivedSlot {
  sheet: string; group: string; col: number; setup: string; facelet: string; lead: number;
  site: string[]; algs: DerivedAlg[];
}
interface SiteCase {
  id: number; name: string; subgroup: string; setup: string; sticker: unknown;
  algs: Record<string, unknown>[][];
}
interface SiteFile { source: string; cases: SiteCase[] }

const SHEET_TO_SET: Record<string, string> = {
  PBL: 'ortega-pbl', CLL: 'cll', 'EG-1': 'eg1', 'EG-2': 'eg2', 'LEG-1': 'leg1',
  'TCLL+': 'tcll-plus', 'TCLL-': 'tcll-minus',
  'LS-1': 'ls1', 'LS-2': 'ls2', 'LS-3': 'ls3', 'LS-4': 'ls4', 'LS-5': 'ls5',
  'LS-6': 'ls6', 'LS-7': 'ls7', 'LS-8': 'ls8', 'LS-9': 'ls9', 'TEG2+': 'teg2-plus',
};
const EXISTING_SLUGS = new Set(['ortega-pbl', 'cll', 'eg1', 'eg2']);
const PBL_EXISTING: Record<string, string> = {
  'Solved#1': 'Adj', 'Solved#2': 'Opp',
  'Bar#1': 'Adj Adj', 'Bar#2': 'Opp Adj',
  'Diag#1': 'Adj Opp', 'Diag#2': 'Opp Opp',
};
const COLORS: Record<string, string> = { U: 'y', R: 'o', F: 'g', D: 'w', L: 'r', B: 'b' };

const derived = JSON.parse(await readFile(input, 'utf8')) as { slots: DerivedSlot[]; anomalies: string[] };
const siteFiles = new Map<string, SiteFile>();
for (const slug of EXISTING_SLUGS) {
  siteFiles.set(slug, JSON.parse(await readFile(resolve(siteDir, `site-${slug}.json`), 'utf8')) as SiteFile);
}

const stickerOf = (facelet: string) => {
  const color = (s: string) => [...s].map((x) => COLORS[x]).join('');
  return {
    kind: 'face', us: color(facelet.slice(0, 4)), ur: color(facelet.slice(4, 8)),
    uf: color(facelet.slice(8, 12)), ul: color(facelet.slice(16, 20)), ub: color(facelet.slice(20, 24)),
  };
};
const dedupe = (entries: Record<string, unknown>[]) => entries.filter((entry, i, all) =>
  all.findIndex((other) => other.alg === entry.alg) === i);

const sets = [] as {
  sheet: string; slug: string; source: string; existing: boolean;
  cases: {
    position: number; existingName: string | null; name: string; subgroup: string; setup: string;
    sticker: unknown; algs: Record<string, unknown>[][];
  }[];
}[];
const quarantine: Record<string, unknown>[] = [];

for (const [sheet, slug] of Object.entries(SHEET_TO_SET)) {
  const slots = derived.slots.filter((slot) => slot.sheet === sheet);
  const siteFile = siteFiles.get(slug);
  const siteByName = new Map(siteFile?.cases.map((c) => [c.name, c]) ?? []);
  const cases = [] as (typeof sets)[number]['cases'];

  for (const [position, slot] of slots.entries()) {
    const state = faceletToPocketState(slot.facelet);
    const existingName = sheet === 'PBL'
      ? PBL_EXISTING[`${slot.group}#${slot.col}`] ?? null
      : slot.site.find((ref) => ref.startsWith(`${slug}/`))?.slice(slug.length + 1) ?? null;
    const old = existingName ? siteByName.get(existingName) : undefined;
    if (existingName && !old) throw new Error(`${sheet} ${slot.group}#${slot.col}:站内 case ${existingName} 不在快照`);

    const lead = slot.algs.find((alg) => alg.row === slot.lead && alg.ok) ?? slot.algs.find((alg) => alg.ok);
    if (!lead?.alignedAlg) throw new Error(`${sheet} ${slot.group}#${slot.col}:没有有效主公式`);
    const sheetEntries = [lead, ...slot.algs.filter((alg) => alg !== lead && alg.ok)]
      .map((alg) => ({ alg: alg.alignedAlg!, source: 'cuberoot' }));
    const oldEntries = (old?.algs.flat() ?? []).map((entry) => {
      const sourceAlg = String(entry.alg ?? '');
      const aligned = alignAlgToState(state, sourceAlg);
      if (!aligned) throw new Error(`${sheet} ${slot.group}#${slot.col}:站内公式对不齐 ${sourceAlg}`);
      return { ...entry, alg: aligned };
    });
    const merged = dedupe([...sheetEntries, ...oldEntries]);
    if (!merged.length) throw new Error(`${sheet} ${slot.group}#${slot.col}:合并后没有公式`);

    for (const alg of slot.algs.filter((item) => !item.ok)) {
      quarantine.push({ sheet, group: slot.group, col: slot.col, row: alg.row, raw: alg.raw,
        branch: alg.alg, choices: alg.choices, reason: 'does_not_solve_slot' });
    }

    cases.push({
      position,
      existingName,
      name: old?.name ?? `${sheet} ${slot.group} ${slot.col + 1}`,
      subgroup: old?.subgroup ?? slot.group,
      setup: slot.setup,
      sticker: old?.sticker ?? stickerOf(slot.facelet),
      algs: [merged],
    });
  }

  const source = siteFile?.source ? `${SHEET_URL}; ${siteFile.source}` : SHEET_URL;
  sets.push({ sheet, slug, source, existing: EXISTING_SLUGS.has(slug), cases });
}

const caseCount = sets.reduce((n, set) => n + set.cases.length, 0);
const activeAlgs = sets.reduce((n, set) => n + set.cases.reduce((m, c) => m + c.algs.flat().length, 0), 0);
const sourceActive = derived.slots.reduce((n, slot) => n + slot.algs.filter((alg) => alg.ok).length, 0);
const updated = sets.reduce((n, set) => n + set.cases.filter((c) => c.existingName).length, 0);
const inserted = caseCount - updated;
if (sets.length !== 17 || caseCount !== 784 || sourceActive !== 2883 || quarantine.length !== 17) {
  throw new Error(`数量不符:sets=${sets.length},cases=${caseCount},sourceActive=${sourceActive},quarantine=${quarantine.length}`);
}
if (updated !== 126 || inserted !== 658) throw new Error(`更新/新增数量不符:${updated}/${inserted}`);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({
  source: SHEET_URL,
  generatedAt: new Date().toISOString(),
  stats: { sets: sets.length, cases: caseCount, sourceActive, mergedActive: activeAlgs, quarantine: quarantine.length, updated, inserted },
  sets,
  quarantine,
}, null, 2), 'utf8');
console.log(`写入 ${output}`);
console.log(JSON.stringify({ sets: sets.length, cases: caseCount, sourceActive, mergedActive: activeAlgs, quarantine: quarantine.length, updated, inserted }));
