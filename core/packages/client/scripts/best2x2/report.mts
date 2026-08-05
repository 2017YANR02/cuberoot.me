/**
 * Best 2x2 Algs 表格的体检报告:逐格反推 case、组内互校、形状核对、与站内既有集配对。
 *
 * 先跑 `fetch.mts` 把 21 张表拉到仓库根 `.tmp/best2x2/`,再:
 *   NODE_USE_ENV_PROXY=1 pnpm -F @cuberoot/client exec tsx scripts/best2x2/report.mts
 *   --json <路径>   顺带把逐格结果写成 JSON(入库脚本吃这个)
 *   --offline       不连站内 API(只做表内自校)
 *   --site-dir <路径> 从本地 `site-<slug>.json` 快照配对,避免网络波动
 *
 * 报告里每一行都是**外部判据**,不是自证:
 *   ① 组内互校 —— 同一格六七条备选公式必须反推出同一个 case;
 *   ② 形状 —— 每套方法对底层有固定要求(CLL 底层整好、EG 底面纯色换一对、LS/TCLL 三角好);
 *   ③ 跨表唯一 —— 784 格必须是 784 个互不相同的 case,撞车就是解析或判据坏了;
 *   ④ 站内配对 —— 与既有 cll/eg1/eg2 对得上的,合并;对不上的,是要新增的。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALG_SHEETS, parseCsv } from './sheets.mjs';
import { parseAlgSheet } from './parse.mts';
import { isAlgLike } from './notation.mts';
import { caseKeyOfAlg, deriveSlot, solvesCase, stateOfAlg, type DerivedSlot } from './derive.mts';
import type { PocketState } from '../../lib/pocket-facelet.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const OFFLINE = process.argv.includes('--offline');
const JSON_AT = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const SITE_DIR = process.argv.includes('--site-dir') ? process.argv[process.argv.indexOf('--site-dir') + 1] : null;

/** 站内既有的 2x2 公式集,按 case key 索引。 */
const SITE_SETS = ['cll', 'eg1', 'eg2', 'ortega-pbl', 'ortega-oll'];
/** 表 → 站内同名集(其余表站内没有对应集)。 */
const SAME_SET: Record<string, string> = { CLL: 'cll', 'EG-1': 'eg1', 'EG-2': 'eg2', 'LEG-1': 'eg1' };
const PAIR_SLUGS: Record<string, string[]> = {
  PBL: ['ortega-pbl'],
  CLL: ['cll', 'ortega-oll'],
  'EG-1': ['eg1'],
  'EG-2': ['eg2'],
  'LEG-1': ['eg1'],
};
/**
 * 已知共用同一批 case 的表:EG-1 与 LEG-1 是同一批题面的右手 / 左手两套公式
 * (见 derive.mts 的 freeTurns —— 差的只是底层转了半圈)。它们撞车是结构,不是错。
 */
const FAMILY: Record<string, string> = { 'EG-1': 'EG-adj', 'LEG-1': 'EG-adj' };
const familyOf = (sheet: string) => FAMILY[sheet] ?? sheet;
/** 站内 ortega-oll 的题面画成「底层已整好」,本来就是 cll 的子集,一格配两处是对的。 */
const SUBSET_OK = (hit: SiteCase[]) =>
  hit.length === 2 && hit.some((c) => c.slug === 'cll') && hit.some((c) => c.slug === 'ortega-oll');
/** PBL 一张表里天然有两种形状:Solved 组底层已整好,另两组底层还差一次交换。 */
const MULTI_SHAPE = new Set(['PBL']);

interface SiteCase { slug: string; name: string; key: string; alg: string; state: PocketState }
const site: SiteCase[] = [];
if (!OFFLINE) {
  for (const slug of SITE_SETS) {
    const payload = SITE_DIR
      ? JSON.parse(await readFile(resolve(ROOT, SITE_DIR, `site-${slug}.json`), 'utf8'))
      : await (async () => {
        const res = await fetch(`https://api.cuberoot.me/v1/alg/sets/2x2/${slug}`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`站内 ${slug} 拉取失败:HTTP ${res.status}`);
        return res.json();
      })();
    const cases = (payload as { cases: { name: string; algs: { alg: string }[][] }[] }).cases;
    for (const c of cases) {
      // 站内 setup 字段 = 首条公式取逆,但那串带着公式的净转体;统一走 derive.mts 同一条
      // 代码路径,免得「各折各的」把残留转体当成差异。
      const alg = c.algs.flat()[0].alg;
      site.push({ slug, name: c.name, key: caseKeyOfAlg(alg), alg, state: stateOfAlg(alg) });
    }
  }
}

/**
 * 一格配站内哪个 case。先比严格 key(快且精确);对不上的再走实测 —— 双向都试:
 * 本格代表公式解不解得掉站内那个题面、以及站内公式解不解得掉本格题面。
 */
function pairSite(s: DerivedSlot): SiteCase[] {
  const allowed = new Set(PAIR_SLUGS[s.sheet] ?? []);
  if (!allowed.size) return [];
  const candidates = site.filter((c) => allowed.has(c.slug));
  const exact = candidates.filter((c) => c.key === s.caseKey);
  if (exact.length) return exact;
  const lead = s.algs.find((a) => a.row === s.lead)!.alg;
  return candidates.filter((c) => solvesCase(c.state, lead) || solvesCase(s.state, c.alg));
}

const all: DerivedSlot[] = [];
const anomalies: string[] = [];
const paired = new Map<DerivedSlot, SiteCase[]>();

/** 一格的底层形状,压成一句人话 —— 同一张表里的格子形状必须一致。 */
const shapeTag = (s: DerivedSlot) =>
  s.shape.dLayerSolved ? '底层整好'
    : s.shape.dLayerOriented ? `底面纯色/归位${s.shape.dSolvedCorners}`
      : `底面${s.shape.dFaceSolid ? '纯色' : '花'}/归位${s.shape.dSolvedCorners}`;

const shapeTagOf = (sh: DerivedSlot['shape']) => shapeTag({ shape: sh } as DerivedSlot);

console.log('表      格数   来源>公式  case  组内全票   逐条一致   站内已有   形状');
for (const sheet of ALG_SHEETS) {
  const csv = await readFile(resolve(ROOT, `.tmp/best2x2/${sheet}.csv`), 'utf8');
  const raws = parseAlgSheet(sheet, parseCsv(csv), isAlgLike).slots.map((s) => ({ ...s, sheet }));

  // 两遍:第一遍先看这张表的格子普遍长什么样(方法定义决定,几十格互证),
  // 第二遍要求每格的代表公式也长这样 —— 否则多数派会把代表挑成形状根本不属于本方法的态。
  const first = raws.map((s) => deriveSlot(s));
  const shapes = new Map<string, number>();
  for (const s of first) shapes.set(shapeTag(s), (shapes.get(shapeTag(s)) ?? 0) + 1);
  const main = [...shapes].sort((a, b) => b[1] - a[1])[0][0];
  const slots = raws.map((s, i) =>
    shapeTag(first[i]) === main ? first[i] : deriveSlot(s, (sh) => shapeTagOf(sh) === main));
  shapes.clear();
  for (const s of slots) shapes.set(shapeTag(s), (shapes.get(shapeTag(s)) ?? 0) + 1);
  all.push(...slots);

  const keys = new Set(slots.map((s) => s.caseKey));
  if (keys.size !== slots.length) anomalies.push(`${sheet}:表内 ${slots.length} 格只有 ${keys.size} 个 case,有格子重复`);

  for (const s of slots) {
    if (shapeTag(s) !== main && !MULTI_SHAPE.has(sheet)) {
      anomalies.push(`${sheet} ${s.group}#${s.col}:形状是「${shapeTag(s)}」,本表主流是「${main}」  ${s.algs[0].raw}`);
    }
    for (const d of s.disagree) {
      const branch = d.variants > 1 ? ` → ${d.alg}` : '';
      anomalies.push(`${sheet} ${s.group}#${s.col} r${d.row}:与本格 case 对不上${branch}  ${d.raw}`);
    }
  }

  for (const s of slots) {
    const hit = OFFLINE ? [] : pairSite(s);
    paired.set(s, hit);
    if (hit.length > 1 && !SUBSET_OK(hit)) {
      anomalies.push(`${sheet} ${s.group}#${s.col}:同时配上站内 ${hit.length} 个 case  ${hit.map((c) => `${c.slug}/${c.name}`).join(' ')}`);
    }
  }

  const sourceTot = raws.reduce((n, s) => n + s.algs.length, 0);
  const tot = slots.reduce((n, s) => n + s.total, 0);
  const agree = slots.reduce((n, s) => n + s.agree, 0);
  const unan = slots.filter((s) => s.agree === s.total).length;
  const inSite = slots.filter((s) => paired.get(s)!.length).length;
  const own = SAME_SET[sheet] && !OFFLINE
    ? slots.filter((s) => paired.get(s)!.some((c) => c.slug === SAME_SET[sheet])).length : null;
  const algCount = sourceTot === tot ? String(tot) : `${sourceTot}>${tot}`;
  console.log(`${sheet.padEnd(7)} ${String(slots.length).padStart(4)} ${algCount.padStart(9)} ${String(keys.size).padStart(5)}`
    + `  ${String(unan).padStart(3)}/${String(slots.length).padEnd(3)}  ${String(agree).padStart(4)}/${String(tot).padEnd(4)}`
    + `  ${OFFLINE ? '  -' : String(inSite).padStart(3)}${own !== null ? `(同名集 ${own})` : '        '}`
    + `   ${[...shapes].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join('  ')}`);
}

// ③ 跨表唯一 —— 同一族内(EG-1 / LEG-1)撞车是结构,跨族撞车才是错。
const byKey = new Map<string, DerivedSlot[]>();
for (const s of all) byKey.set(s.caseKey, [...(byKey.get(s.caseKey) ?? []), s]);
let shared = 0;
for (const [, v] of byKey) {
  if (v.length < 2) continue;
  if (new Set(v.map((s) => familyOf(s.sheet))).size === 1) { shared++; continue; }
  anomalies.push(`跨表撞车:${v.map((s) => `${s.sheet}/${s.group}#${s.col}`).join('  ')}`);
}

const algs = all.reduce((n, s) => n + s.total, 0);
console.log(`\n合计 ${all.length} 格 / ${algs} 条公式 → ${byKey.size} 个互不相同的 case`
  + `(其中 ${shared} 个由同族的两张表共用)`);
if (!OFFLINE) {
  const have = all.filter((s) => paired.get(s)!.length).length;
  const usedSite = new Set(all.flatMap((s) => paired.get(s)!.map((c) => `${c.slug}/${c.name}`)));
  console.log(`站内已有 ${have} 格,需要新增 ${all.length - have} 格`);
  console.log(`站内 ${site.length} 个 case 里 ${usedSite.size} 个在表中出现,${site.length - usedSite.size} 个表里没有`);
  for (const c of site) if (!usedSite.has(`${c.slug}/${c.name}`)) console.log(`  表里没有:${c.slug}/${c.name}  ${c.alg}`);
}
console.log(`\n可疑项 ${anomalies.length} 条:`);
anomalies.forEach((a) => console.log('  ' + a));

if (JSON_AT) {
  const out = resolve(ROOT, JSON_AT);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({
    slots: all.map((s) => ({
      sheet: s.sheet, group: s.group, col: s.col, caseKey: s.caseKey, setup: s.setup, facelet: s.facelet,
      shape: s.shape, agree: s.agree, total: s.total,
      site: paired.get(s)!.map((c) => `${c.slug}/${c.name}`),
      algs: s.algs.map((a) => ({
        alg: a.alg, alignedAlg: a.alignedAlg, raw: a.raw, row: a.row, caseKey: a.caseKey,
        ok: a.solves, eitherAuf: a.eitherAuf,
        choices: a.choices, variant: a.variant, variants: a.variants,
      })),
    })),
    anomalies,
  }, null, 2), 'utf8');
  console.log(`\n逐格结果写到 ${out}`);
}
