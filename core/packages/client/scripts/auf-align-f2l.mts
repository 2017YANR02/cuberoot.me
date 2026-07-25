/**
 * auf-align-f2l —— 把末槽类公式集的**展示 AUF** 对齐到 /alg/3x3/f2l。
 *
 * ## 为什么需要
 *
 * F2L 的 41 个 case 是 **AUF 等价类**(两块都在 U 层 96/4=24 + 角在槽 24/4=6 +
 * 棱在槽 24/4=6 + 两块都在槽 5 = 41)。同一个类里有 4 个代表(彼此差一个 U^m),
 * f2l 挑了一个,zbls 每个 case 又各自挑了一个 —— 于是同名 case 两边的图对不上,
 * 差的就是这个 pre-AUF。更糟的是 zbls **同一个 subgroup 内部**都不一致:34 个
 * subgroup 里的卡片各朝各的向,本来「只差顶棱翻色形状」的一组图没法横向比。
 *
 * 缩略图是 **setup** 画的(`CaseThumb` → `VisualCube`,`setup` 优先于 `algorithm`),
 * 所以对齐 = 改 setup;为保持 `setup + 公式 = 目标态`,公式开头补上抵消的 U。
 *
 *   新 setup = 旧 setup · U^m        (图转过去)
 *   新公式   = U^-m + 旧公式          (先转回来,再做原来的事)
 *
 * ## 为什么这是纯展示改动、不改变 case 身份
 *
 * U^m 作用在整个末态上:对子的 U 层块、顶棱翻色形状一起转,**相对关系不变** ⟹ 还是
 * 同一个 ZBLS case、同一条解法(换个视角看)。U 不破坏顶棱朝向,ZBLS 前提保住。
 * 四个朝向组在 y 换面下 U↦U,同一个 U^-m 前缀通吃。
 *
 * ## 前缀往哪插
 *
 * 原文里混着上游标注(`=` 本条与上一条等价)和开头的整体转体(`=y U F R U' R' F'`)。
 * 标注不是招式,必须留在最前;**y 与 U 可交换**(同一根轴),所以前缀穿过开头那串 y
 * 再和紧随的 U 合并 —— `=y U F R…` 补 U' 得 `=y F R…`,而不是难看的 `=U' y U F R…`。
 * 合并只碰「补进去的那一步和它紧邻的那一步」,不动上游别处的写法。
 *
 * ## setup 是给人看的,写法也得干净
 *
 * 「打乱」那一行(`SetupLine`)把 setup 原文显示出来、还能点复制,所以它不只要语义对、
 * 写法也要正常。补 U 之后一律过 {@link tidyMoves} 折 mod 4 —— 别用 cubing.js 的
 * `experimentalSimplify`,它会把 `U2 U2` 合成 `U4`(见那个函数的注释)。
 *
 * ## 用法
 *
 *   pnpm exec tsx scripts/auf-align-f2l.mts [set…]          # 干跑,只报告
 *   ADMIN_API_KEY=… pnpm exec tsx scripts/auf-align-f2l.mts zbls --send
 *
 * 默认跑 zbls。闸门与 normalize-slot-to-fr 同款:任一校验不过整批不发;发完逐字段回读。
 */

import { Alg, Move } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { createRequire } from 'node:module';
import type { KPattern } from 'cubing/kpuzzle';
import type { AlgCase, AlgEntry, AlgSticker } from '@cuberoot/shared';

// 判据取站上那一份真源。CJS interop 的缘由见 normalize-slot-to-fr.mts 头注。
const require = createRequire(import.meta.url);
const { toMoveString } = require('@cuberoot/shared/alg-notation') as typeof import('@cuberoot/shared/alg-notation');
const { goalOf, reachesGoal } = require('../lib/alg_goals.ts') as typeof import('../lib/alg_goals.ts');

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? '';
const argv = process.argv.slice(2);
const SEND = argv.includes('--send');
const THROTTLE_MS = Number(argv.find(a => a.startsWith('--throttle='))?.slice(11) ?? 2100);
const SHOW = Number(argv.find(a => a.startsWith('--show='))?.slice(7) ?? 5);
const RATE_WINDOW_MS = 60_000;
const SETS = argv.filter(a => !a.startsWith('--'));

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const apply = (s: string) => SOLVED.applyAlg(new Alg(s || ''));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const UPOW = ['', 'U', 'U2', "U'"];
const YPOW = ['', 'y', 'y2', "y'"];

// ─────────────────────────────────────────────────────────────────────────────
// 对子签名
// ─────────────────────────────────────────────────────────────────────────────
// FR 槽的两块:角块 id 4(DFR)、棱块 id 8(FR)。cubing.js 编号见 lib/alg_goals.ts 头注。
const PAIR_CORNER = 4;
const PAIR_EDGE = 8;
const OTHER_CORNERS = [5, 6, 7];
const OTHER_EDGES = [9, 10, 11];
const CROSS_EDGES = [4, 5, 6, 7];

type Slots = { pieces: number[]; orientation: number[] };

interface Sig { pair: string; clean: boolean }

/** 对子构型签名 =(角块在哪+朝向, 棱块在哪+朝向)。`clean` = 底十字与另三槽都完好。 */
function sigOf(p: KPattern): Sig {
  const c = p.patternData.CORNERS as unknown as Slots;
  const e = p.patternData.EDGES as unknown as Slots;
  const at = (d: Slots, id: number) => {
    const i = d.pieces.indexOf(id);
    return `${i}.${d.orientation[i] ?? 0}`;
  };
  const home = (d: Slots, ids: number[]) => ids.every(i => d.pieces[i] === i && (d.orientation[i] ?? 0) === 0);
  return {
    pair: `c${at(c, PAIR_CORNER)}|e${at(e, PAIR_EDGE)}`,
    clean: home(c, OTHER_CORNERS) && home(e, OTHER_EDGES) && home(e, CROSS_EDGES),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 往公式开头插 U^j
// ─────────────────────────────────────────────────────────────────────────────

/** `U`/`U2`/`U'` 的写法;j 已折 mod 4,0 → 空串。 */
const uMove = (j: number) => UPOW[((j % 4) + 4) % 4];

// ─────────────────────────────────────────────────────────────────────────────
// 招式串收拾:合并相邻同族 + 转动量折 mod 4
// ─────────────────────────────────────────────────────────────────────────────

/** `[2R]` `Rw2'` `M2` `y'` …:可选层前缀 + 族名 + 可选圈数 + 可选撇。 */
const MOVE_RE = /^(\d*)([A-Za-z]+w?)(\d*)('?)$/;

/**
 * 相邻同族招式合并、转动量折回 0..3、折出 0 的整步删掉。3x3 上所有族(面 / 中层 /
 * 宽层 / 整体转体)阶都是 4,所以折 mod 4 不改变语义。
 *
 * **别指望 cubing.js 的 `experimentalSimplify` 干这件事** —— 它只合并相邻同面招式,
 * 不知道阶是 4,`U2` 接 `U2` 会给你 `U4`(转一圈 = 没转)。语义没错,所以画出来的图、
 * 跑出来的判据全是对的,**但 setup 那一行文字是显示给人看、还能点复制的**,
 * `F' U F U4` 就是脏数据。2026-07-25 修过一次:上一版本这里直接用 simplify 的输出,
 * 给 41 条 zbls setup 留下了 `U3`/`U4`/`U5`。
 *
 * 删掉一步之后左右两边可能又变成同族相邻(`R U4 R` → `R R`),所以做到不动为止。
 * 认不出来的 token(不该有,兜底)原样留着,并且不跨过它合并。
 *
 * **没被合并、量也在 |amt| ≤ 2 内的 token 一律原样保留** —— 上游写的 `U2'`(与 `U2` 等价)
 * 是它自己的记号习惯,不是我要修的东西;这个函数只负责铲越界的量,不做全库风格统一。
 */
function tidyMoves(s: string): string {
  let toks = s.split(/\s+/).filter(Boolean);
  for (let round = 0; round < 8; round++) {
    // src = 该组仍是「原封不动的单个 token」时的原文;一旦合并过就置 null
    const out: { fam: string | null; src: string | null; amt: number }[] = [];
    for (const t of toks) {
      const m = MOVE_RE.exec(t);
      if (!m) { out.push({ fam: null, src: t, amt: 0 }); continue; }
      const [, layer, fam, turns, prime] = m;
      const amt = (turns ? Number(turns) : 1) * (prime ? -1 : 1);
      const key = `${layer}${fam}`;
      const last = out[out.length - 1];
      if (last && last.fam === key) { last.amt += amt; last.src = null; }
      else out.push({ fam: key, src: t, amt });
    }
    const next = out.flatMap(x => {
      if (x.fam === null) return [x.src!];
      if (x.src !== null && x.amt !== 0 && Math.abs(x.amt) <= 2) return [x.src];
      const a = ((x.amt % 4) + 4) % 4;
      if (a === 0) return [];
      return [x.fam + (a === 1 ? '' : a === 2 ? '2' : "'")];
    });
    if (next.length === toks.length && next.every((t, i) => t === toks[i])) break;
    toks = next;
  }
  return toks.join(' ');
}

/**
 * 在 `alg` 开头插入 `U^j`。上游标注留在最前;穿过开头那串整体 y 转体(与 U 可交换);
 * 与紧随的第一步 U 合并(抵消掉就一起消失)。j=0 时原样返回。
 */
function prependU(alg: string, j: number): string {
  if (((j % 4) + 4) % 4 === 0) return alg;
  // 标记原样保留(库里统一写成紧贴的 `=`,不擅自加空格)
  const mk = /^(\s*[=*]\s*)?([\s\S]*)$/.exec(alg)!;
  const mark = (mk[1] ?? '').trimStart();
  const body = mk[2].trim();

  const toks = body.split(/\s+/).filter(Boolean);
  // 开头的整体 y 转体照抄过去(y 与 U 同轴可换序)
  const lead: string[] = [];
  let i = 0;
  while (i < toks.length && /^y[2']?'?$/.test(toks[i])) lead.push(toks[i++]);

  let amt = j;
  // 和紧邻的那一步 U 合并
  const next = toks[i];
  if (next && /^U[2']?'?$/.test(next)) {
    amt += next === 'U' ? 1 : next === "U'" ? -1 : 2;
    i++;
  }
  const head = uMove(amt);
  return mark + [...lead, head, ...toks.slice(i)].filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// 判据 —— `lib/alg_validation.ts` 的 f2l 系分支,逐字照抄(同 normalize-slot-to-fr)
// ─────────────────────────────────────────────────────────────────────────────

function validate(setup: string, alg: string, sticker: AlgSticker, set: string): { ok: boolean; reason?: string } {
  const goal = goalOf('3x3', set, sticker.kind);
  if (goal === 'skip') return { ok: true };
  if (!alg.trim()) return { ok: true };
  let cleanAlg: string, cleanSetup: string, leaf: Move[];
  try {
    cleanAlg = toMoveString(alg);
    cleanSetup = setup ? toMoveString(setup) : '';
    leaf = [...new Alg(cleanAlg).experimentalLeafMoves()];
    if (cleanSetup) new Alg(cleanSetup);
  } catch (e) { return { ok: false, reason: `公式语法错误: ${(e as Error).message}` }; }

  const head = (cleanSetup ? cleanSetup + ' ' : '') + cleanAlg;
  const run = (tail: string) => {
    try { return kpuzzle.defaultPattern().applyAlg(tail ? `${head} ${tail}` : head); } catch { return null; }
  };
  if (goal === 'f2l' || goal === 'f2l+co' || goal === 'f2l+eo') {
    const last = leaf[leaf.length - 1];
    if (last && last.family === 'U') return { ok: false, reason: `公式末尾的 ${last} 是多余的 AUF` };
    const p = run('');
    if (!p || !reachesGoal(p, kpuzzle, '3x3', goal)) return { ok: false, reason: `没达到目标态 (${goal})` };
    return { ok: true };
  }
  for (const auf of ['', 'U', 'U2', "U'"]) {
    const p = run(auf);
    if (p && reachesGoal(p, kpuzzle, '3x3', goal)) return { ok: true };
  }
  return { ok: false, reason: `没达到目标态 (${goal})` };
}

// ─────────────────────────────────────────────────────────────────────────────
// 计划
// ─────────────────────────────────────────────────────────────────────────────

interface Plan {
  c: AlgCase;
  m: number;
  free: boolean;              // 对子两块都在槽内 ⟹ AUF 转不动它,m 无意义
  setupNew: string;
  algsNew: AlgEntry[][];
  standardNew: string | null;
}

type Ctx = { f2lSig: Map<string, string> };

const flat = (a?: AlgEntry[][]) => (a ?? []).map(g => g.map(e => e.alg).join(' / ')).join(' || ');

/**
 * 这个 case 到底有没有变。**不能拿 `m !== 0` 当判据** —— setup 只是需要收拾写法
 * (`U4` → 删)时 m 就是 0,用 m 判会把这些漏掉,正是 2026-07-25 那 41 条的成因。
 */
function changed(p: Plan): boolean {
  return (p.c.setup || '').trim() !== p.setupNew
    || flat(p.c.algs) !== flat(p.algsNew)
    || (p.standardNew ?? null) !== (p.c.standard ?? null);
}

/**
 * 故意没有 f2l 对应的 subgroup。f2l 的 41 个 case 全是**未解**的对子,「对子已解」不在其中 ——
 * 这类 case 无从对齐(U 也转不动已归位的对子),是预期跳过,不是失败。除它以外任何排不出
 * 计划的都算失败并卡住整批。
 */
const NO_F2L_COUNTERPART = new Set(['Solved Pair']);

function planCase(c: AlgCase, ctx: Ctx): Plan {
  const setup = (c.setup || '').trim();
  if (!setup) throw new Error('无 setup');
  const target = ctx.f2lSig.get(c.subgroup ?? '');
  if (!target) throw new Error(`f2l 里没有同名 case「${c.subgroup}」`);

  const base = apply(toMoveString(setup));
  if (!sigOf(base).clean) throw new Error('底十字或另三槽不完好,不是末槽 case');

  const hits: number[] = [];
  for (let m = 0; m < 4; m++) if (sigOf(base.applyAlg(new Alg(UPOW[m]))).pair === target) hits.push(m);
  if (hits.length === 0) {
    throw new Error(`四个 AUF 都对不上 f2l「${c.subgroup}」(本地 ${sigOf(base).pair} / 目标 ${target})`);
  }
  const free = hits.length === 4;
  const m = hits.includes(0) ? 0 : hits[0];

  const j = (4 - m) % 4;
  const algsNew = (c.algs ?? []).map(g => g.map(e => ({ ...e, alg: prependU(e.alg, j) })));
  const standardNew = c.standard ? prependU(c.standard, j) : null;
  // 无条件过 tidyMoves —— m=0 时它就是那把「把库里已有的 U4 收拾干净」的扫帚
  const setupNew = tidyMoves(`${toMoveString(setup)} ${UPOW[m]}`.trim());

  return { c, m, free, setupNew, algsNew, standardNew };
}

/** 归一后:①对子签名 == f2l ②每条公式过站上判据 ③`standard` 也过。 */
function verify(p: Plan, ctx: Ctx, set: string): string[] {
  const bad: string[] = [];
  const tag = `${p.c.subgroup}/${p.c.name}`;
  const target = ctx.f2lSig.get(p.c.subgroup ?? '')!;

  const sig = sigOf(apply(p.setupNew)).pair;
  if (sig !== target) bad.push(`${tag}: 归一后签名 ${sig} ≠ f2l ${target}`);

  // 新 setup 必须**逐块**等于「旧 setup · U^m」—— 这一条专门卡 tidyMoves:签名只看对子,
  // 收拾招式串要是把十字或别的槽动了,只有整状态比才抓得到。
  const want = apply(`${toMoveString(p.c.setup || '')} ${UPOW[p.m]}`.trim());
  const gotP = apply(p.setupNew);
  if (JSON.stringify(gotP.patternData) !== JSON.stringify(want.patternData)) {
    bad.push(`${tag}: 收拾后的 setup「${p.setupNew}」与「旧 setup · U^${p.m}」不是同一状态`);
  }
  if (!sigOf(gotP).clean) bad.push(`${tag}: 收拾后底十字/另三槽不完好`);

  const oriSetup = (gi: number) => (gi === 0 ? p.setupNew : `${p.setupNew} ${YPOW[gi]}`);
  p.algsNew.forEach((g, gi) => g.forEach((e, i) => {
    const r = validate(oriSetup(gi), e.alg, p.c.sticker, set);
    if (!r.ok) bad.push(`${tag} ori${gi}#${i}「${e.alg}」: ${r.reason}`);
  }));

  // `standard` 是 algs[0][0] 剥掉 AUF/转体的那一份 —— 它自己不带 AUF,所以补 16 种前缀试
  if (p.standardNew) {
    const ok = YPOW.some(y => UPOW.some(u => validate(p.setupNew, `${u} ${y} ${p.standardNew}`.trim(), p.c.sticker, set).ok));
    const wasOk = p.c.standard
      ? YPOW.some(y => UPOW.some(u => validate(toMoveString(p.c.setup || ''), `${u} ${y} ${p.c.standard}`.trim(), p.c.sticker, set).ok))
      : true;
    if (!ok && wasOk) bad.push(`${tag}: standard「${p.standardNew}」归一后不过(原来是过的)`);
  }
  return bad;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

async function loadSet(set: string): Promise<AlgCase[]> {
  const r = await fetch(`${API}/${set}?fresh=${Date.now()}`);
  if (!r.ok) throw new Error(`GET ${set} → ${r.status}`);
  return (await r.json()).cases as AlgCase[];
}

async function buildCtx(): Promise<Ctx> {
  const f2l = await loadSet('f2l');
  const f2lSig = new Map<string, string>();
  for (const c of f2l) {
    const s = sigOf(apply(toMoveString(c.setup || '')));
    if (!s.clean) throw new Error(`f2l/${c.name} 的 setup 不是干净末槽态`);
    f2lSig.set(c.name, s.pair);
  }
  console.log(`[f2l] ${f2l.length} 个 case,签名建好;去重后 ${new Set(f2lSig.values()).size} 个不同构型`);
  return { f2lSig };
}

function selfTest(): void {
  const cases: [string, number, string][] = [
    ["=y U F R U' R' F'", 3, "=y F R U' R' F'"],   // 穿过 y,与 U 合并抵消
    ["U R U' R'", 1, "U2 R U' R'"],                 // 与 U 合并
    ["R U R'", 2, "U2 R U R'"],                     // 直接插
    ["U2 R U R'", 3, "U R U R'"],                   // U'+U2 = U
    ["y2 R U R'", 1, "y2 U R U R'"],                // y2 也穿
    ["*U' L' U L", 2, "*U L' U L"],                 // U2+U' = U,标记紧贴不加空格
  ];
  for (const [inp, j, want] of cases) {
    const got = prependU(inp, j);
    if (got.replace(/\s+/g, ' ') !== want.replace(/\s+/g, ' ')) {
      throw new Error(`selfTest 失败: prependU("${inp}", ${j}) = "${got}",期望 "${want}"`);
    }
    // 语义:「U^j 接原公式」和新公式必须是同一个变换
    const a = apply(`${uMove(j)} ${toMoveString(inp)}`);
    const b = apply(toMoveString(got));
    if (JSON.stringify(a.patternData) !== JSON.stringify(b.patternData)) {
      throw new Error(`selfTest 语义不符: "${inp}" + U^${j}`);
    }
  }
  console.log(`[自检] prependU ${cases.length} 例通过(写法 + 语义)`);

  const tidy: [string, string][] = [
    ["F' U F U2 U2", "F' U F"],            // 上一版留下的 U4:整步删掉
    ["R U' R' U2 U2 U", "R U' R' U"],      // U5 → U
    ["F' U F U2 U", "F' U F U'"],          // U3 → U'
    ["R U4 R", 'R2'],                      // 删完左右同族 ⟹ 再合一轮
    ["M2 M", "M'"],                        // 中层同族照样合
    ["R U R'", "R U R'"],                  // 干净的原样不动
    ["Rw2 R", 'Rw2 R'],                    // Rw 与 R 不同族,不许合
    ["F' U2' F", "F' U2' F"],              // 上游的 U2' 记号照原样,不统一成 U2
    ["F' U2' U2 F", ''],                   // 但它参与合并就按标准写法算(这里连带 F' F 一起消完)
  ];
  for (const [inp, want] of tidy) {
    const got = tidyMoves(inp);
    if (got !== want) throw new Error(`selfTest 失败: tidyMoves("${inp}") = "${got}",期望 "${want}"`);
    if (JSON.stringify(apply(inp).patternData) !== JSON.stringify(apply(got).patternData)) {
      throw new Error(`selfTest 语义不符: tidyMoves("${inp}")`);
    }
  }
  console.log(`[自检] tidyMoves ${tidy.length} 例通过(写法 + 语义)`);
}

async function run(set: string, ctx: Ctx): Promise<void> {
  const cases = await loadSet(set);
  console.log(`\n${'='.repeat(76)}\n== 3x3/${set} —— ${cases.length} 个 case\n${'='.repeat(76)}`);

  const plans: Plan[] = [];
  const fails: string[] = [];
  const skips: string[] = [];
  for (const c of cases) {
    if (NO_F2L_COUNTERPART.has(c.subgroup ?? '')) { skips.push(`${c.subgroup}/${c.name}`); continue; }
    try { plans.push(planCase(c, ctx)); }
    catch (e) { fails.push(`${c.subgroup}/${c.name}: ${(e as Error).message}`); }
  }

  const tally = new Map<number, number>();
  for (const p of plans) tally.set(p.m, (tally.get(p.m) ?? 0) + 1);
  console.log(`\n[盘点] 需要补的 U : ${[...tally].sort((a, b) => a[0] - b[0]).map(([k, v]) => `U^${k}=${v}`).join('  ')}`);
  console.log(`[盘点] 要改的 case: ${plans.filter(changed).length} / ${plans.length}`);
  console.log(`[盘点]   其中只是收拾 setup 写法(m=0): ${plans.filter(p => changed(p) && p.m === 0).length}`);
  console.log(`[盘点] 对子全在槽: ${plans.filter(p => p.free).length}(AUF 转不动它,不改)`);
  if (skips.length) console.log(`[盘点] 预期跳过  : ${skips.length}(${skips.join(', ')} —— f2l 里没有「对子已解」这个 case)`);
  if (fails.length) {
    console.log(`\n[失败] ${fails.length} 个排不出计划:`);
    for (const f of fails.slice(0, 12)) console.log(`  ${f}`);
    if (fails.length > 12) console.log(`  …还有 ${fails.length - 12} 个`);
  }

  const bySub = new Map<string, Set<number>>();
  for (const p of plans) {
    const k = p.c.subgroup ?? '?';
    if (!bySub.has(k)) bySub.set(k, new Set());
    bySub.get(k)!.add(p.m);
  }
  const inconsistent = [...bySub].filter(([, s]) => s.size > 1);
  console.log(`[盘点] 归一前同 subgroup 内朝向不一致的: ${inconsistent.length} / ${bySub.size} 个 subgroup`);

  const bad = plans.flatMap(p => verify(p, ctx, set));
  console.log(`\n[校验] 归一后不过的: ${bad.length}`);
  for (const b of bad.slice(0, 15)) console.log(`  ${b}`);

  console.log(`\n[样例] 前 ${SHOW} 个要改的(--show=N 调条数):`);
  for (const p of plans.filter(changed).slice(0, SHOW)) {
    console.log(`  ${p.c.subgroup}/${p.c.name}  补 U^${(4 - p.m) % 4}`);
    console.log(`    setup: ${p.c.setup}  →  ${p.setupNew}`);
    console.log(`    alg  : ${p.c.algs?.[0]?.[0]?.alg}  →  ${p.algsNew[0]?.[0]?.alg}`);
  }

  if (!SEND) { console.log('\n(干跑;加 --send 才落库)'); return; }

  const blockers: string[] = [];
  if (!ADMIN_KEY) blockers.push('缺 ADMIN_API_KEY');
  if (fails.length) blockers.push(`${fails.length} 个 case 排不了计划`);
  if (bad.length) blockers.push(`${bad.length} 条归一后校验不过`);
  if (plans.some(p => p.c.id == null)) blockers.push('有 case 没 id');
  if (blockers.length) {
    console.log(`\n拒绝发送 —— ${blockers.join(';')}`);
    process.exitCode = 1;
    return;
  }

  const todo = plans.filter(changed);
  console.log(`\n[发送] ${todo.length} 个 case,间隔 ${THROTTLE_MS}ms…`);
  let sent = 0;
  for (const p of todo) {
    const body = {
      caseName: p.c.name,
      subgroup: p.c.subgroup,
      setup: p.setupNew,
      standard: p.standardNew ?? p.c.standard,
      sticker: p.c.sticker,
      algs: p.algsNew,
      ...(p.c.oriNames ? { oriNames: p.c.oriNames } : {}),
      ...(p.c.trainerKey ? { trainerKey: p.c.trainerKey } : {}),
    };
    let ok = false;
    for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
      try {
        const r = await fetch(`${API}/${set}/cases/${p.c.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
          body: JSON.stringify(body),
        });
        if (r.status === 429) { console.log('  429,等一个窗口…'); await sleep(RATE_WINDOW_MS); continue; }
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        ok = true;
      } catch (e) {
        if (attempt === 4) { console.log(`  ✗ ${p.c.subgroup}/${p.c.name}: ${(e as Error).message}`); break; }
        await sleep(2000 * attempt);
      }
    }
    if (ok && ++sent % 20 === 0) console.log(`  …${sent}/${todo.length}`);
    await sleep(THROTTLE_MS);
  }
  console.log(`[发送] 完成 ${sent}/${todo.length}`);

  const after = await loadSet(set);
  const byId = new Map(after.map(c => [c.id, c]));
  let diff = 0;
  for (const p of todo) {
    const got = byId.get(p.c.id!);
    if (!got) { console.log(`  回读缺 ${p.c.subgroup}/${p.c.name}`); diff++; continue; }
    if ((got.setup || '').trim() !== p.setupNew) { console.log(`  setup 不符 ${p.c.subgroup}/${p.c.name}: ${got.setup}`); diff++; }
    else if (flat(got.algs) !== flat(p.algsNew)) { console.log(`  algs 不符 ${p.c.subgroup}/${p.c.name}`); diff++; }
    else if ((got.standard ?? null) !== (p.standardNew ?? p.c.standard ?? null)) { console.log(`  standard 不符 ${p.c.subgroup}/${p.c.name}`); diff++; }
  }
  console.log(`[回读] 逐字段复核不符: ${diff}`);
}

selfTest();
const ctx = await buildCtx();
for (const s of (SETS.length ? SETS : ['zbls'])) await run(s, ctx);
