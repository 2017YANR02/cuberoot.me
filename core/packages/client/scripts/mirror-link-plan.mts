/*
 * mirror-link-plan — issue #40 T5 的 **§5.7 槽位核对 + `mirror_case_id` 建链**,**只算不写**。
 *
 * ## 这脚本回答三个问题
 *
 *  1. **§5.7**:候选 set 是不是真的「有且仅有一个 F2L 槽,且在 FR」?(计划里写的是候选,没核过。)
 *  2. **粒度**:这个 set 的一个 case 到底由什么决定?(不是猜,见下。)
 *  3. **建链**:每个 case 的镜像伙伴是哪一个 case?找不到的有几个(那些要 server 自动新建)?
 *
 * ## 怎么判「谁是谁的镜像」
 *
 * 不靠名字(`A+` ↔ `A-` 只是**结论**,不是判据 —— 拿它当输入就成了循环论证)。实测下来
 * f2l 的 ± 命名与状态判据全对,zbls 只有三成对得上 —— 名字真的不能信。判据是**状态**:
 *
 *     σ(c) = 左右镜(M 平面) ∘ 把槽转回 FR 的 y 重贴
 *
 * 左右镜把槽从 FR 送到 FL,所以要补一个 y 重贴才回到本 set 的坐标系(与 §5.1 说的
 * 「M 镜像落到伙伴的 FL-view」是同一件事)。Roux 系(sbls)不补:它的目标态在 y 下**不封闭**
 * (DR 会转到 DF),但在左右镜下是封闭的(DR↔DL、FR↔FL、BR↔BL 都在块内)。
 *
 * ## 指纹粒度:实测,不照 SET_GOAL 猜
 *
 * 「两个 case 是同一个」⟺「同一批公式能解」。所以指纹只记**这个 set 的公式真正解掉的东西**。
 * 关键是那个「真正」—— `SET_GOAL` 给 vls 标的是 `f2l+co`,可 VLS 的公式**连顶层棱朝向一起解**
 * (subgroup 就叫 `UB` / `UBUL`,说的正是顶棱朝向)。照 `f2l+co` 做指纹,一堆 case 会塌成一个,
 * 配对全废。所以粒度改成**跑一遍全库公式实测**:顶层角朝向 / 角排列 / 棱朝向 / 棱排列,
 * 哪一项 100% 的公式都解掉了,哪一项就进指纹。判据仍是站上那份 `reachesGoal`(模 24 转体)。
 *
 * ## 跨 set 配对
 *
 * 镜像伙伴不一定在同一个 set 里:WV 的镜像是 SV 那一族(`R U R'` 插入 ↔ `F' U' F` 插入)。
 * 所以指纹索引是**全局**的,只按「粒度相同」分桶 —— 粒度不同的 set 之间指纹不可比,不许撞。
 *
 * ## 判据自检(跑起来就验,错了当场抛/记账)
 *
 *   - 公式重写表 vs 贴纸反射,400 条随机公式对撞(`_relabel.mts` 的 selfTestRelabel);
 *   - σ 是对合:`fp(σ(σ(c))) === fp(c)`,逐 case;
 *   - 镜像公式仍解得掉:`σ(setup) + σ(alg)` 过 `goalOf`/`reachesGoal`;
 *   - 保留记号的镜像版与 leaf-move 版逐招相等(记号保住了,转动一个不能差)。
 *
 * ## 跑
 *
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *     pnpm --filter @cuberoot/client exec tsx scripts/mirror-link-plan.mts
 *   … scripts/mirror-link-plan.mts --set=f2l,zbls --verbose
 *
 * 输出明细 `.tmp/mirror-link-plan.json`。**没有写路径** —— 落库是 server 端 `utils/alg_mirror.ts`
 * 的事,这里只出计划给人看。
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import type { AlgCase } from '@cuberoot/shared';
import { YPOW_INV, relabel, relabelPreserving, mirrorAlg, mirrorPreserving, selfTestRelabel } from './_relabel.mts';

const require = createRequire(import.meta.url);
const { toMoveString } = require('@cuberoot/shared/alg-notation') as typeof import('@cuberoot/shared/alg-notation');
const { goalOf, reachesGoal } = require('../lib/alg_goals.ts') as typeof import('../lib/alg_goals.ts');
type AlgGoal = ReturnType<typeof goalOf>;

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const apply = (s: string) => SOLVED.applyAlg(new Alg(s || ''));

// ─────────────────────────────────────────────────────────────────────────────
// 候选 set(§5.7 清单)
// ─────────────────────────────────────────────────────────────────────────────

interface SetCfg {
  /** 镜像后怎么回到本 set 的坐标系:把槽转回 FR,还是钉死 y²。 */
  renorm: 'fr-slot' | 'y2';
  note?: string;
}

const SETS: Record<string, SetCfg> = {
  f2l: { renorm: 'fr-slot' },
  'adv-f2l': { renorm: 'fr-slot' },
  zbls: { renorm: 'fr-slot' },
  wv: { renorm: 'fr-slot' },
  cls: { renorm: 'fr-slot' },
  vls: { renorm: 'fr-slot' },
  // Roux:左右镜把「缺一对」从右块换到左块,补 y² 换回来(y² 保 Roux 棱集:DR↔DL、FR↔BL、FL↔BR)。
  // 单个 y 反而不行 —— DR 会转到 DF,那是 M 层,不在块里。
  sbls: { renorm: 'y2', note: 'Roux 二块:补 y² 而非「转回 FR」' },
  sv: { renorm: 'fr-slot' },
};

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const only = argv.find(a => a.startsWith('--set='))?.slice('--set='.length);
const setNames = only ? only.split(',').filter(Boolean) : Object.keys(SETS);

// ─────────────────────────────────────────────────────────────────────────────
// 槽位盘点(§5.7)
// ─────────────────────────────────────────────────────────────────────────────

/** 四个 F2L 槽的 (角块槽位, 棱块槽位) —— cubing.js 编号见 lib/alg_goals.ts 头注。 */
const SLOTS = [
  { name: 'FR', corner: 4, edge: 8 },
  { name: 'FL', corner: 5, edge: 9 },
  { name: 'BL', corner: 6, edge: 11 },
  { name: 'BR', corner: 7, edge: 10 },
] as const;
const CROSS_EDGES = [4, 5, 6, 7];

/** 24 个整体朝向 —— 找「中心归位」的那一个。 */
const ROTS: string[] = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());

interface SlotInfo {
  /** 末态残留的整体转体("" = 中心已归位) */
  residual: string;
  /** 破掉的 F2L 槽(按颜色框架,即中心归位后的位置) */
  broken: string[];
  crossOk: boolean;
  /** 中心归位后的 pattern */
  framed: KPattern;
}

function inspect(p: KPattern): SlotInfo {
  let rot: string | null = null;
  for (const r of ROTS) {
    const q = r ? p.applyAlg(new Alg(r)) : p;
    if ((q.patternData.CENTERS.pieces as number[]).every((v, i) => v === i)) { rot = r; break; }
  }
  if (rot === null) throw new Error('no orientation puts centers home (impossible for 3x3)');
  const q = rot ? p.applyAlg(new Alg(rot)) : p;

  const c = q.patternData.CORNERS, e = q.patternData.EDGES;
  const sc = SOLVED.patternData.CORNERS, se = SOLVED.patternData.EDGES;
  const same = (o: typeof c, b: typeof c, i: number) =>
    (o.pieces as number[])[i] === (b.pieces as number[])[i]
    && ((o.orientation as number[])[i] ?? 0) === ((b.orientation as number[])[i] ?? 0);
  const broken = SLOTS.filter(s => !same(c, sc, s.corner) || !same(e, se, s.edge)).map(s => s.name);
  const crossOk = CROSS_EDGES.every(i => (e.pieces as number[])[i] === i && ((e.orientation as number[])[i] ?? 0) === 0);

  const yIdx = ROTS.indexOf(rot);
  return { residual: rot === '' ? '' : (yIdx < 4 ? YPOW_INV[yIdx] : `inv(${rot})`), broken, crossOk, framed: q };
}

// ─────────────────────────────────────────────────────────────────────────────
// 粒度:这个 set 的公式到底解掉了什么(实测)
// ─────────────────────────────────────────────────────────────────────────────

/** 指纹要记哪些东西。全 false = 只记 F2L 那批块。 */
interface Grain {
  /** F2L 四槽全解 vs Roux 二块 */
  family: 'f2l' | 'roux';
  /** 顶层角朝向进指纹 */
  cOri: boolean;
  /** 顶层角是谁进指纹(排列) */
  cPerm: boolean;
  /** 自由棱的朝向进指纹 */
  eOri: boolean;
  /** 自由棱是谁进指纹 */
  ePerm: boolean;
}

const grainKey = (g: Grain) => `${g.family}${g.cOri ? 'C' : ''}${g.cPerm ? 'P' : ''}${g.eOri ? 'E' : ''}${g.ePerm ? 'Q' : ''}`;

/**
 * 跑一遍全库公式,看哪些性质是 **100% 成立**的 —— 那些才是 case 粒度的一部分。
 * 判据用站上的 `reachesGoal`(自带 24 转体容忍),不自造。
 */
function detectGrain(states: KPattern[]): { grain: Grain; rates: Record<string, string> } {
  const rate = (g: AlgGoal) => states.filter(p => reachesGoal(p, kpuzzle, '3x3', g)).length / (states.length || 1);
  const all = (g: AlgGoal) => states.length > 0 && rate(g) === 1;
  const family: Grain['family'] = all('f2l') ? 'f2l' : 'roux';
  const grain: Grain = {
    family,
    cOri: family === 'f2l' ? all('f2l+co') : all('cmll'),
    cPerm: family === 'f2l' ? all('ll-corners') : all('cmll'),
    eOri: family === 'f2l' ? all('f2l+eo') : all('roux-blocks+eo'),
    ePerm: all('solve'),
  };
  const ladder: AlgGoal[] = family === 'f2l'
    ? ['f2l', 'f2l+co', 'f2l+eo', 'oll', 'll-corners', 'solve']
    : ['roux-blocks', 'roux-blocks+eo', 'cmll', 'solve'];
  const rates: Record<string, string> = {};
  for (const g of ladder) rates[g] = `${(rate(g) * 100).toFixed(0)}%`;
  return { grain, rates };
}

// ─────────────────────────────────────────────────────────────────────────────
// 指纹
// ─────────────────────────────────────────────────────────────────────────────

const D_CORNERS = new Set([4, 5, 6, 7]);
const F2L_EDGES = new Set([4, 5, 6, 7, 8, 9, 10, 11]);
const ROUX_EDGES = new Set([5, 7, 8, 9, 10, 11]);

/** 一个固定 AUF 下的指纹。`p` 必须已经中心归位。 */
function fpAt(p: KPattern, g: Grain): string {
  const realE = g.family === 'roux' ? ROUX_EDGES : F2L_EDGES;
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  const cs: string[] = [], es: string[] = [];
  for (let i = 0; i < 8; i++) {
    const piece = (c.pieces as number[])[i], ori = (c.orientation as number[])[i] ?? 0;
    const real = D_CORNERS.has(piece);
    // 目标不管的块本身可互换 —— 只有当「它是谁」也被解掉时才记 piece 号
    const id = real || g.cPerm ? String(piece) : 'x';
    cs.push(real || g.cOri || g.cPerm ? `${id}.${ori}` : id);
  }
  for (let i = 0; i < 12; i++) {
    const piece = (e.pieces as number[])[i], ori = (e.orientation as number[])[i] ?? 0;
    const real = realE.has(piece);
    const id = real || g.ePerm ? String(piece) : 'x';
    es.push(real || g.eOri || g.ePerm ? `${id}.${ori}` : id);
  }
  return `${cs.join(',')}|${es.join(',')}`;
}

/** 模首 AUF 的指纹 —— 公式开头的 `U^a` 不改变「这是哪个 case」。 */
function fingerprint(framed: KPattern, g: Grain): string {
  let best = '';
  for (const auf of ['', 'U', 'U2', "U'"]) {
    const s = fpAt(auf ? framed.applyAlg(auf) : framed, g);
    if (!best || s < best) best = s;
  }
  return best;
}

/** Roux 左块:角 DFL/DBL,棱 DL/FL/BL。 */
const LEFT_BLOCK_C = [5, 6];
const LEFT_BLOCK_E = [7, 9, 11];

/**
 * Roux 系的颜色框架**不能拿中心定** —— sbls 有 40/65 个 case 的 setup 带 x 转体,
 * 中心归位之后 Roux 两块跑到了别的轴上,同一个 set 里的指纹根本不可比。
 * 改用「哪个转体让**左块**归位」来钉框架:左块是 SBLS 里恒定解好的那半边,能唯一定住朝向。
 * 左镜之后解好的那半边跑到右边,这里同样会自动找出补偿的 y²。找不到就返回 null(记账)。
 */
function rouxFrame(p: KPattern): KPattern | null {
  for (const r of ROTS) {
    const q = r ? p.applyAlg(new Alg(r)) : p;
    const c = q.patternData.CORNERS, e = q.patternData.EDGES;
    const okC = LEFT_BLOCK_C.every(i => (c.pieces as number[])[i] === i && ((c.orientation as number[])[i] ?? 0) === 0);
    const okE = LEFT_BLOCK_E.every(i => (e.pieces as number[])[i] === i && ((e.orientation as number[])[i] ?? 0) === 0);
    if (okC && okE) return q;
  }
  return null;
}

/** 按粒度选框架:F2L 系用中心归位,Roux 系用左块归位。 */
function frameFor(slot: SlotInfo, raw: KPattern, g: Grain): { framed: KPattern; ok: boolean } {
  if (g.family !== 'roux') return { framed: slot.framed, ok: true };
  const f = rouxFrame(raw);
  return f ? { framed: f, ok: true } : { framed: slot.framed, ok: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// σ:镜像 + 回到本 set 的坐标系
// ─────────────────────────────────────────────────────────────────────────────

interface Sigma {
  /** 镜像并重贴后的 setup(干净公式串) */
  setup: string;
  k: number;
  info: SlotInfo;
}

function sigmaSetup(setupMoves: string, cfg: SetCfg): Sigma {
  const mirrored = mirrorAlg(setupMoves);
  if (cfg.renorm === 'y2') {
    const s = relabel(mirrored, 2);
    return { setup: s, k: 2, info: inspect(apply(s)) };
  }
  for (let k = 0; k < 4; k++) {
    const s = relabel(mirrored, k);
    const info = inspect(apply(s));
    if (info.broken.length === 1 && info.broken[0] === 'FR') return { setup: s, k, info };
  }
  // 槽本来就是好的(zbls 的 O 组 = 对子已归位)—— 没有槽要转,k=0 就是对的,不算异常
  const zero = inspect(apply(mirrored));
  if (zero.broken.length === 0) return { setup: mirrored, k: 0, info: zero };
  // 真落不回 FR(多槽)—— 原样返回,由调用方记成异常
  return { setup: mirrored, k: -1, info: zero };
}

/** 公式跟着 σ 走:同一个镜 + 同一个 k。输入是干净公式串。 */
const sigmaAlg = (algMoves: string, k: number) => relabel(mirrorAlg(algMoves), Math.max(k, 0));

/**
 * 同一个 σ,但**保留上游记号**(`(…)`、`=`、`↓↑` 换握标原样留住)—— 落库要写的是这一版,
 * 抹平了手指分组魔友看到的就是另一条公式。正确性不靠它自己保证:调用方逐条断言
 * `toMoveString(保留版) === sigmaAlg(toMoveString(原文))`。
 */
const sigmaAlgPreserving = (raw: string, k: number) => relabelPreserving(mirrorPreserving(raw), Math.max(k, 0));

// ─────────────────────────────────────────────────────────────────────────────
// 装载
// ─────────────────────────────────────────────────────────────────────────────

/**
 * case 的基准 setup(第 0 朝向)。setup 为空时退化成「首条公式取逆」——
 * 与 `lib/alg_validation.ts` 的 `setupForCase` 同一约定。
 */
function baseSetup(c: AlgCase): string {
  const raw = (c.setup ?? '').trim();
  if (raw) return toMoveString(raw);
  const first = c.algs?.[0]?.[0]?.alg;
  if (!first) return '';
  return new Alg(toMoveString(first)).invert().toString();
}

/** F 族 = `F`/`f` 两族,B 族 = `B`/`b`(§5.2 拍板:`S`/`z` 不算)。 */
const hasFamily = (moves: string, letters: string[]) =>
  [...new Alg(moves).experimentalLeafMoves()].some(m => letters.includes(m.family));
const F_FAM = ['F', 'f', 'Fw'];
const B_FAM = ['B', 'b', 'Bw'];

interface Loaded {
  set: string;
  cfg: SetCfg;
  cases: AlgCase[];
  declaredGoal: AlgGoal;
  grain: Grain;
  rates: Record<string, string>;
  info: Map<AlgCase, { setup: string; slot: SlotInfo; fp: string; frameOk: boolean }>;
}

async function load(set: string): Promise<Loaded | null> {
  const cfg = SETS[set] ?? { renorm: 'fr-slot' };
  let data: { cases: AlgCase[] };
  try {
    const res = await fetch(`https://api.cuberoot.me/v1/alg/sets/3x3/${set}?fresh=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.log(`${set}: 拉取失败 —— ${(err as Error).message}`);
    return null;
  }

  const declaredGoal = goalOf('3x3', set, data.cases[0]?.sticker?.kind as never);

  // 粒度:拿第 0 朝向的全部公式跑末态
  const ends: KPattern[] = [];
  for (const c of data.cases) {
    const setup = baseSetup(c);
    for (const entry of c.algs?.[0] ?? []) {
      if (!entry.alg?.trim()) continue;
      try { ends.push(apply(`${setup} ${toMoveString(entry.alg)}`)); } catch { /* 记号坏,跳过 */ }
    }
  }
  const { grain, rates } = detectGrain(ends);

  const info = new Map<AlgCase, { setup: string; slot: SlotInfo; fp: string; frameOk: boolean }>();
  for (const c of data.cases) {
    const setup = baseSetup(c);
    const raw = apply(setup);
    const slot = inspect(raw);
    const { framed, ok } = frameFor(slot, raw, grain);
    info.set(c, { setup, slot, fp: fingerprint(framed, grain), frameOk: ok });
  }
  return { set, cfg, cases: data.cases, declaredGoal, grain, rates, info };
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

selfTestRelabel(kpuzzle);

const loaded: Loaded[] = [];
for (const s of setNames) {
  const l = await load(s);
  if (l) loaded.push(l);
}

/**
 * 最粗的粒度:只看 F2L 那批块 —— 也就是「这是 41 个 F2L 情形里的哪一个」。
 * 缺伙伴时拿它报「伙伴的 F2L 构型是什么」,不然只能干说一句「没找到」。
 */
const BASE_GRAIN: Grain = { family: 'f2l', cOri: false, cPerm: false, eOri: false, ePerm: false };
const baseNames = new Map<string, string>();
for (const c of loaded.find(l => l.set === 'f2l')?.cases ?? []) {
  baseNames.set(fingerprint(inspect(apply(baseSetup(c))).framed, BASE_GRAIN), `${c.subgroup}/${c.name}`);
}
const baseNameOf = (framed: KPattern) => baseNames.get(fingerprint(framed, BASE_GRAIN)) ?? '?';

/** 全局指纹索引,**按粒度分桶** —— 粒度不同的 set 指纹不可比,不许撞。 */
const index = new Map<string, { set: string; c: AlgCase }[]>();
for (const l of loaded) {
  for (const c of l.cases) {
    const key = `${grainKey(l.grain)}#${l.info.get(c)!.fp}`;
    const bucket = index.get(key) ?? [];
    bucket.push({ set: l.set, c });
    index.set(key, bucket);
  }
}

interface Row {
  set: string; id?: number; name: string; subgroup: string;
  brokenSlots: string[]; residual: string; crossOk: boolean;
  fp: string; mirrorFp: string; k: number;
  mirrorId: number | null; mirrorSet: string | null; mirrorName: string | null;
  self: boolean; gen3: number; gen1: number;
  /** 这个 case 属于 41 个 F2L 情形里的哪一个 / 镜过去之后是哪一个(Roux 系为 '?') */
  baseCase: string; mirrorBaseCase: string;
  /** 颜色框架定住了没(Roux 系靠左块定;F2L 系恒 true) */
  frameOk: boolean;
  sample?: { alg: string; mirrored: string };
}

interface Report {
  l: Loaded;
  slotHist: Record<string, number>;
  residualHist: Record<string, number>;
  crossBad: number; singleSlotFR: number;
  dupFp: string[];
  pairs: number; selfMirror: number; missing: number; crossSet: Record<string, number>;
  involutionBad: number; algChecked: number; algBad: number; algBadList: string[];
  nameAgree: number; namePairs: number;
  rows: Row[];
}

const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };

const signOf = (c: AlgCase) => {
  const k = `${c.subgroup ?? ''}|${c.name}`;
  return /[+]/.test(k) ? '+' : /[\-−]/.test(k) ? '-' : '';
};

/**
 * 名字是不是 `X+` / `X-` 这一对。只用来**核对**配对结果,不参与配对
 * (拿它当判据就是循环论证)。两边都不带 ± 号的 set(如 cls 的 `FDR00`/`RFD00`)不统计。
 */
function isPlusMinusPair(a: AlgCase, b: AlgCase): boolean {
  const strip = (s: string) => s.replace(/[+\-−]/g, '').trim();
  const ka = `${a.subgroup ?? ''}|${a.name}`, kb = `${b.subgroup ?? ''}|${b.name}`;
  return strip(ka) === strip(kb) && signOf(a) !== '' && signOf(a) !== signOf(b);
}

const reports: Report[] = [];
for (const l of loaded) {
  const r: Report = {
    l, slotHist: {}, residualHist: {}, crossBad: 0, singleSlotFR: 0, dupFp: [],
    pairs: 0, selfMirror: 0, missing: 0, crossSet: {},
    involutionBad: 0, algChecked: 0, algBad: 0, algBadList: [],
    nameAgree: 0, namePairs: 0, rows: [],
  };
  const seen = new Map<string, AlgCase>();

  for (const c of l.cases) {
    const { setup, slot, fp } = l.info.get(c)!;
    bump(r.slotHist, slot.broken.length === 1 ? slot.broken[0] : `${slot.broken.length}槽[${slot.broken.join('+')}]`);
    bump(r.residualHist, slot.residual || '(无)');
    if (!slot.crossOk) r.crossBad++;
    if (slot.broken.length === 1 && slot.broken[0] === 'FR') r.singleSlotFR++;
    if (seen.has(fp)) r.dupFp.push(`${c.subgroup}/${c.name} ≡ ${seen.get(fp)!.subgroup}/${seen.get(fp)!.name}`);
    else seen.set(fp, c);

    const fpOf = (s: Sigma) => fingerprint(frameFor(s.info, apply(s.setup), l.grain).framed, l.grain);
    const sig = sigmaSetup(setup, l.cfg);
    const mfp = fpOf(sig);
    const hits = index.get(`${grainKey(l.grain)}#${mfp}`) ?? [];
    // 同 set 优先,其次跨 set
    const partner = hits.find(h => h.set === l.set) ?? hits[0] ?? null;

    // σ 是对合:再镜一次必须回到自己
    if (fpOf(sigmaSetup(sig.setup, l.cfg)) !== fp) r.involutionBad++;

    // 公式镜过去还解不解得掉
    let sample: Row['sample'];
    if (l.declaredGoal !== 'skip' && sig.k >= 0) {
      for (const entry of c.algs?.[0] ?? []) {
        if (!entry.alg?.trim()) continue;
        r.algChecked++;
        let ok = false, why = '';
        try {
          const mAlg = sigmaAlg(toMoveString(entry.alg), sig.k);
          ok = reachesGoal(apply(`${sig.setup} ${mAlg}`), kpuzzle, '3x3', l.declaredGoal);
          if (!ok) why = `镜像后没达成 ${l.declaredGoal}`;
          // 保留记号版必须和 leaf-move 版逐招相等 —— 记号保住了,转动一个不能差
          const kept = sigmaAlgPreserving(entry.alg, sig.k);
          if (ok && toMoveString(kept) !== mAlg) { ok = false; why = `保留记号版与 leaf-move 版不一致:"${kept}"`; }
          if (ok && !sample) sample = { alg: entry.alg, mirrored: kept };
        } catch (e) { why = `重写失败:${(e as Error).message}`; }
        if (!ok) { r.algBad++; r.algBadList.push(`${c.subgroup}/${c.name} "${entry.alg}" — ${why}`); }
      }
    }

    // §5.2 的生成份数
    let gen3 = 0, gen1 = 0;
    for (const entry of c.algs?.[0] ?? []) {
      if (!entry.alg?.trim()) continue;
      let moves: string;
      try { moves = toMoveString(entry.alg); } catch { continue; }
      if (hasFamily(moves, B_FAM) || !hasFamily(moves, F_FAM)) gen3++; else gen1++;
    }

    const self = mfp === fp;
    if (self) r.selfMirror++;
    else if (partner) {
      r.pairs++;
      if (partner.set !== l.set) bump(r.crossSet, partner.set);
      if (signOf(c) || signOf(partner.c)) {
        r.namePairs++;
        if (isPlusMinusPair(c, partner.c)) r.nameAgree++;
      }
    } else r.missing++;

    r.rows.push({
      set: l.set, id: c.id, name: c.name, subgroup: c.subgroup ?? '',
      brokenSlots: slot.broken, residual: slot.residual, crossOk: slot.crossOk,
      fp, mirrorFp: mfp, k: sig.k,
      mirrorId: self ? (c.id ?? null) : (partner?.c.id ?? null),
      mirrorSet: self ? l.set : (partner?.set ?? null),
      mirrorName: self ? `${c.subgroup}/${c.name}` : (partner ? `${partner.c.subgroup}/${partner.c.name}` : null),
      self, gen3, gen1, sample,
      baseCase: l.grain.family === 'f2l' ? baseNameOf(slot.framed) : '?',
      mirrorBaseCase: l.grain.family === 'f2l' ? baseNameOf(sig.info.framed) : '?',
      frameOk: l.info.get(c)!.frameOk,
    });
  }
  reports.push(r);
}

// ── 输出

const GRAIN_ZH: Record<'cOri' | 'cPerm' | 'eOri' | 'ePerm', string> = {
  cOri: '顶角朝向', cPerm: '顶角排列', eOri: '棱朝向', ePerm: '棱排列',
};

console.log(`\n${'='.repeat(98)}`);
console.log('§5.7 槽位核对 + 粒度实测');
console.log('='.repeat(98));
for (const r of reports) {
  const { l } = r;
  const hist = Object.entries(r.slotHist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ');
  const verdict = r.singleSlotFR === l.cases.length ? '✅ 全部单槽 FR' : `⚠️ 只有 ${r.singleSlotFR}/${l.cases.length} 是单槽 FR`;
  const extras = (Object.keys(GRAIN_ZH) as (keyof typeof GRAIN_ZH)[]).filter(k => l.grain[k]).map(k => GRAIN_ZH[k]);
  console.log(`\n${l.set.padEnd(8)} ${String(l.cases.length).padStart(4)} case   ${verdict}`);
  console.log(`         槽位: ${hist}`);
  console.log(`         残留转体: ${Object.entries(r.residualHist).map(([k, v]) => `${k}=${v}`).join('  ')}${r.crossBad ? `   ❌ 底十字破 ${r.crossBad}` : '   底十字全好'}`);
  console.log(`         SET_GOAL 声明 ${l.declaredGoal};实测达成率 ${Object.entries(l.rates).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`         → 指纹粒度 ${grainKey(l.grain)}(${l.grain.family === 'roux' ? 'Roux 二块' : 'F2L 四槽'}${extras.length ? ' + ' + extras.join(' + ') : ''})${r.dupFp.length ? `   ⚠️ ${r.dupFp.length} 组 case 指纹撞车` : ''}`);
  if (l.grain.family === 'f2l' && baseNames.size) {
    const tally = (pick: (x: Row) => string) => {
      const m: Record<string, number> = {};
      for (const x of r.rows) bump(m, pick(x));
      return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`).join('  ');
    };
    console.log(`         F2L 构型: ${tally(x => x.baseCase)}   ⇒ 镜像后: ${tally(x => x.mirrorBaseCase)}`);
  }
  const frameBad = r.rows.filter(x => !x.frameOk).length;
  if (frameBad) console.log(`         ⚠️ ${frameBad} 个 case 定不住颜色框架(Roux 左块没归位)`);
  if (l.cfg.note) console.log(`         注: ${l.cfg.note}`);
  if (r.dupFp.length && VERBOSE) for (const d of r.dupFp.slice(0, 8)) console.log(`           撞车 ${d}`);
}

console.log(`\n${'='.repeat(98)}`);
console.log('mirror_case_id 建链计划(判据 = 状态指纹;名字只用来事后核对)');
console.log('='.repeat(98));
console.log(`${'set'.padEnd(9)}${'case'.padStart(5)}${'配对'.padStart(7)}${'自镜像'.padStart(8)}${'缺伙伴'.padStart(8)}${'对合'.padStart(7)}  ${'公式镜像校验'.padStart(14)}  ±命名一致  跨 set 伙伴`);
for (const r of reports) {
  const inv = r.involutionBad ? `❌${r.involutionBad}` : '✅';
  const alg = r.l.declaredGoal === 'skip' ? '(未建模,跳过)' : `${r.algChecked - r.algBad}/${r.algChecked}${r.algBad ? ' ❌' : ' ✅'}`;
  const nm = r.namePairs ? `${r.nameAgree}/${r.namePairs}` : '—';
  const cross = Object.entries(r.crossSet).map(([k, v]) => `${k}×${v}`).join(' ') || '—';
  console.log(
    `${r.l.set.padEnd(9)}${String(r.l.cases.length).padStart(5)}${String(r.pairs).padStart(7)}${String(r.selfMirror).padStart(8)}` +
    `${String(r.missing).padStart(8)}${inv.padStart(7)}  ${alg.padStart(14)}  ${nm.padStart(9)}  ${cross}`,
  );
}

const totGen3 = reports.reduce((n, r) => n + r.rows.reduce((m, x) => m + x.gen3, 0), 0);
const totGen1 = reports.reduce((n, r) => n + r.rows.reduce((m, x) => m + x.gen1, 0), 0);
console.log(`\n§5.2 生成量预估(只数第 0 朝向):不含 F 族 / 含 B 族 → 生成 3 份的 ${totGen3} 条;含 F 不含 B → 只生成 M 份的 ${totGen1} 条。`);
console.log(`  即自动生成 ${totGen3 * 3 + totGen1} 条镜像公式(去重前)。`);

for (const r of reports) {
  if (r.algBadList.length) {
    console.log(`\n[!] ${r.l.set} 镜像后解不掉的 ${r.algBadList.length} 条:`);
    for (const b of r.algBadList.slice(0, 12)) console.log(`    ${b}`);
    if (r.algBadList.length > 12) console.log(`    …还有 ${r.algBadList.length - 12} 条`);
  }
  const missing = r.rows.filter(x => !x.self && x.mirrorId === null);
  if (missing.length) {
    console.log(`\n[!] ${r.l.set} 全库都找不到伙伴的 ${missing.length} 个 case:`);
    for (const m of missing.slice(0, 12)) console.log(`    ${m.subgroup}/${m.name}${m.k < 0 ? '  (镜像后落不回 FR)' : ''}`);
    if (missing.length > 12) console.log(`    …还有 ${missing.length - 12} 个`);
  }
  const offFR = r.rows.filter(x => !(x.brokenSlots.length === 1 && x.brokenSlots[0] === 'FR'));
  if (offFR.length && offFR.length <= 12) {
    console.log(`\n[!] ${r.l.set} 不是单槽 FR 的 ${offFR.length} 个 case:`);
    for (const m of offFR) console.log(`    ${m.subgroup}/${m.name} — 破槽 [${m.brokenSlots.join(',') || '无'}]${m.residual ? ` 残留 ${m.residual}` : ''}`);
  }
}

if (VERBOSE) {
  console.log(`\n${'='.repeat(98)}\n逐 case 配对\n${'='.repeat(98)}`);
  for (const r of reports) {
    console.log(`\n-- ${r.l.set}`);
    for (const x of r.rows) {
      const tag = x.self ? '自镜像' : x.mirrorName ? `${x.mirrorSet !== x.set ? x.mirrorSet + ':' : ''}${x.mirrorName}` : '(缺)';
      console.log(`  ${(x.subgroup + '/' + x.name).padEnd(28)} → ${tag}`);
    }
  }
}

console.log(`\n${'='.repeat(98)}\n镜像重写样例(保留上游记号,每个 set 取前 3 条)\n${'='.repeat(98)}`);
for (const r of reports) {
  const withSample = r.rows.filter(x => x.sample).slice(0, 3);
  if (!withSample.length) continue;
  console.log(`\n-- ${r.l.set}`);
  for (const x of withSample) {
    console.log(`  ${(x.subgroup + '/' + x.name).padEnd(24)} ${x.sample!.alg}`);
    console.log(`  ${('→ ' + (x.mirrorSet && x.mirrorSet !== x.set ? x.mirrorSet + ':' : '') + (x.mirrorName ?? '(缺)')).padEnd(24)} ${x.sample!.mirrored}`);
  }
}

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/mirror-link-plan.json', JSON.stringify({
  generatedFor: 'issue #40 T5 — mirror_case_id',
  sets: reports.map(r => ({
    set: r.l.set, declaredGoal: r.l.declaredGoal, grain: r.l.grain, grainKey: grainKey(r.l.grain),
    goalRates: r.l.rates, cases: r.l.cases.length,
    singleSlotFR: r.singleSlotFR, pairs: r.pairs, selfMirror: r.selfMirror, missing: r.missing,
    crossSet: r.crossSet, involutionBad: r.involutionBad, algChecked: r.algChecked, algBad: r.algBad,
    dupFingerprints: r.dupFp,
    links: r.rows.filter(x => x.mirrorId != null).map(x => ({
      id: x.id, mirrorCaseId: x.mirrorId, mirrorSet: x.mirrorSet, self: x.self,
      name: `${x.subgroup}/${x.name}`, mirrorName: x.mirrorName,
    })),
    rows: r.rows,
  })),
}, null, 2));
console.log('\n明细(含每个 case 的 mirror_case_id):.tmp/mirror-link-plan.json');
console.log('本脚本没有任何写路径 —— 落库归 server 端 utils/alg_mirror.ts。');
