/*
 * normalize-slot-to-fr — 把 `3x3/zbls`(305 案)、`3x3/wv`(27 案)的**最后一槽统一到 FR**。
 *
 * ## 问题
 *
 * 这两个 set 的 case 是从上游抓来的,setup 里最后一槽有时落在 FR、有时落在 FL/BL/BR;
 * 一部分 setup 末尾还挂着 `y'` 之类的整体转体 —— 缩略图连**底色朝向**都不一致
 * (VisualCube 固定机位:setup 里留一个 `y'`,渲染出来的前面就从绿变成红)。
 * 目标形态照 `3x3/f2l`:槽固定 FR,四个朝向由 `oriNames` + 二维 `algs` 表达。
 *
 * ## 做法(两步,都用 KPuzzle 实证,不靠推)
 *
 *  1. **抽掉整体转体**:把 setup 里的 `y` 往后推(`y^a B` → `R_{-a}(B) y^a`),推到末尾直接丢掉。
 *     结果是**不含转体**的等价 setup,末态中心归位 —— 缩略图底色随之统一。
 *  2. **y 共轭挪槽**:再整体重贴一次面标(`R_m`),把破的那个槽转到 FR。
 *
 * `R_k(A)` = 把 A 的每个招式按 y^k 重贴面标,定义成 `pattern(R_k(A)) == pattern(y^-k A y^k)`。
 * 全表(含 M/E/S、宽招、x/y/z)在 `FACE_MAP`,**启动时逐个招式拿 KPuzzle 验一遍**才继续。
 *
 * setup 走「抽转体 + R_m」,同一个 case 的每条公式走 `R_{m-a}` —— 两边合起来正好抵消,
 * 复算见 `planCase()` 里的推导。每条重写完的 `setup + alg` 都过 `validateAlgCase`
 * (与站上校验器同一份判据:zbls = f2l+eo,wv = f2l+co)。
 *
 * ## 运行
 *
 *   pnpm --filter @cuberoot/client exec tsx scripts/normalize-slot-to-fr.mts             # dry-run(默认)
 *   pnpm --filter @cuberoot/client exec tsx scripts/normalize-slot-to-fr.mts --set=wv
 *   pnpm --filter @cuberoot/client exec tsx scripts/normalize-slot-to-fr.mts --verbose   # 逐 case 打前后对照
 *   pnpm --filter @cuberoot/client exec tsx scripts/normalize-slot-to-fr.mts --four      # 四向升级预演(只算不写)
 *   pnpm --filter @cuberoot/client exec tsx scripts/normalize-slot-to-fr.mts --apply     # 只打印将要发的请求
 *   ADMIN_API_KEY=… pnpm … normalize-slot-to-fr.mts --set=zbls --send                    # 真写库
 *
 * ## 四向(2026-07-24 已落库)
 *
 * 归一到 FR 之后 `algs[k] = R_k(algs[0])`(k = 0..3 → FR/FL/BL/BR)+ `oriNames`,形状与
 * `3x3/f2l` 一致 —— 前端的 y 旋转控件是数据驱动的(`AlgCategoryView` 看 `oriNames.length > 1`),
 * 数据一改就自动出控件,不用动组件。`standard` 也是公式,跟着一起重贴。
 *
 * ## 写路径
 *
 * `--send` 是唯一的写路径,端点 `PUT /v1/alg/sets/3x3/:set/cases/:id` + `X-Admin-Key`
 * (见 skill `alg-admin-api`),key 只从 `ADMIN_API_KEY` 环境变量取。三道保险:
 *   1. **闸门** —— 规划失败 / 公式校验不过 / 重贴弄坏 standard / 四向校验不过 / 没生成满
 *      4 组,任一条命中就整批不发(宁可不写,不写半套);
 *   2. **节流** —— server 是 30 次 / 60 秒(按 IP),默认 2.1s 间隔 + 429 退避重试;
 *   3. **回读复核** —— 发完重新 GET 一遍,逐字段比对 setup / algs / oriNames / standard。
 *
 * 脚本**可重跑**:已四向化的 case 再跑一次不会二次重贴(`algs` 不是 1 组就跳过生成),
 * 校验也按组配 `setup y^gi`,所以中断后直接重跑即可。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Alg, Move } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import type { AlgCase, AlgEntry, AlgSticker } from '@cuberoot/shared';
// 面标重贴表(y 重贴 + 左右镜)与 T5 的 mirror-link-plan 共用一份,别在这儿再抄。
import { YPOW, YPOW_INV, relabel, relabelMove, relabelPreserving, selfTestRelabel } from './_relabel.mts';

// tsx 的 CJS interop 下本地 .ts 的命名 ESM 导入会失败(见 gen-lsll-zbls-overlay.mts 头注)。
// `lib/alg_goals.ts` 只有 type-only import,能直接 require —— **判据取的是站上那一份真源**。
// `lib/alg_validation.ts` 运行时 import 了 cubing/alg(ESM-only),CJS 侧加载不了;它对
// f2l 系那条分支很薄(normalizeAlg → 末尾 AUF 拦截 → reachesGoal),照抄在 `validate()` 里。
const require = createRequire(import.meta.url);
const { toMoveString } = require('@cuberoot/shared/alg-notation') as typeof import('@cuberoot/shared/alg-notation');
const { goalOf, reachesGoal } = require('../lib/alg_goals.ts') as typeof import('../lib/alg_goals.ts');

/**
 * 公式开头**恰好**是 `y^j` 时剥掉它,返回剩余部分;不匹配返回 null。
 *
 * `=` / `*`(上游的等价 / 推荐标注)在 y 前面,要留住:`=y U F R U' R' F'` → `=U F R U' R' F'`。
 * 判据是「恰好 j 次」而不是「有没有 y」—— 见 `planCase()` 里孤儿前缀那段注释。
 */
function stripLeadRot(alg: string, j: number): string | null {
  if (j === 0) return null;
  const mt = /^(\s*[=*]?\s*)(y2'|y2|y'|y)(?:\s+|$)(.*)$/.exec(alg);
  if (!mt) return null;
  const AMT: Record<string, number> = { y: 1, y2: 2, "y2'": 2, "y'": 3 };
  if (AMT[mt[2]] !== j) return null;
  return (mt[1].trim() + mt[3]).trim() || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPuzzle 侧
// ─────────────────────────────────────────────────────────────────────────────

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

/** 24 个整体朝向 —— 找「中心归位」的那一个。 */
const ROTS: string[] = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());

const eqPattern = (a: KPattern, b: KPattern) =>
  JSON.stringify(a.patternData) === JSON.stringify(b.patternData);

const apply = (s: string) => SOLVED.applyAlg(new Alg(s || ''));

/** 四个 F2L 槽的 (角块槽位, 棱块槽位) —— cubing.js 编号见 lib/alg_goals.ts 头注。 */
const SLOTS = [
  { name: 'FR', corner: 4, edge: 8 },
  { name: 'FL', corner: 5, edge: 9 },
  { name: 'BL', corner: 6, edge: 11 },
  { name: 'BR', corner: 7, edge: 10 },
] as const;
const CROSS_EDGES = [4, 5, 6, 7];

interface SlotInfo {
  /** 末态的整体转体("" = 中心已归位) */
  residual: string;
  /** 整体转体折算成的 y 次数;非纯 y 转体时为 null */
  residualY: number | null;
  /** 破掉的槽(按**渲染出来的几何位置**,即固定机位下肉眼看到的位置) */
  geom: string[];
  /** 破掉的槽(按**颜色框架**,即中心归位后的位置) */
  color: string[];
  /** 底十字是否完好 */
  crossOk: boolean;
}

/** 把一个 pattern 拆成「整体转体 + 哪些槽是破的」。 */
function inspect(p: KPattern): SlotInfo {
  // 中心归位需要的补偿转体 r:p·r 中心归位 ⟹ p 的整体朝向 = r 的逆
  let rot: string | null = null;
  for (const r of ROTS) {
    const q = r ? p.applyAlg(new Alg(r)) : p;
    if ((q.patternData.CENTERS.pieces as number[]).every((v, i) => v === i)) { rot = r; break; }
  }
  if (rot === null) throw new Error('no orientation puts centers home (impossible for 3x3)');

  const q = rot ? p.applyAlg(new Alg(rot)) : p;                 // 颜色框架(中心归位)
  const ref = rot ? SOLVED.applyAlg(new Alg(rot).invert()) : SOLVED; // 同朝向的「已还原」参照

  const broken = (pat: KPattern, base: KPattern) => {
    const c = pat.patternData.CORNERS, e = pat.patternData.EDGES;
    const bc = base.patternData.CORNERS, be = base.patternData.EDGES;
    const same = (o: any, b: any, i: number) => o.pieces[i] === b.pieces[i] && (o.orientation[i] ?? 0) === (b.orientation[i] ?? 0);
    return SLOTS.filter(s => !same(c, bc, s.corner) || !same(e, be, s.edge)).map(s => s.name);
  };

  const be = q.patternData.EDGES;
  const crossOk = CROSS_EDGES.every(i => be.pieces[i] === i && (be.orientation[i] ?? 0) === 0);

  const yIdx = ROTS.indexOf(rot);
  // ROTS 前 4 项是纯 y 转体("", y, y2, y')。rot 是「补偿」,残留朝向 = 它的逆。
  const residualY = yIdx >= 0 && yIdx < 4 ? (4 - yIdx) % 4 : null;

  return {
    residual: rot === '' ? '' : YPOW_INV[yIdx] ?? `inv(${rot})`,
    residualY,
    geom: broken(p, ref),
    color: broken(q, SOLVED),
    crossOk,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 抽转体:`A y^a B` → `A R_{-a}(B)`,末尾的 y^a 丢掉
// ─────────────────────────────────────────────────────────────────────────────

interface Stripped { moves: string; ypow: number }

function stripRotations(algStr: string): Stripped {
  let acc = 0;
  const out: Move[] = [];
  for (const m of new Alg(algStr).experimentalLeafMoves()) {
    if (m.family === 'y') { acc = (((acc + m.amount) % 4) + 4) % 4; continue; }
    if (m.family === 'x' || m.family === 'z') {
      throw new Error(`setup 里有 x/z 转体,本脚本只处理 y:${algStr}`);
    }
    out.push(relabelMove(m, (4 - acc) % 4));
  }
  return { moves: cancelAdjacent(out).join(' '), ypow: acc };
}

/**
 * 抽掉转体会把原本隔着转体的两招并到一起 —— `U' y' U` 变成 `U' U`(U 和 y 可交换,原文里
 * 它们本来就没挨着)。只**删相邻抵消掉的同族对**,不做别的合并:`U U` 是上游本来就这么写的,
 * 归一化不该顺手改人家的写法。循环到不动点。
 */
function cancelAdjacent(moves: Move[]): string[] {
  const out = [...moves];
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i], b = out[i + 1];
      if (a.family !== b.family) continue;
      if ((((a.amount + b.amount) % 4) + 4) % 4 !== 0) continue;
      out.splice(i, 2);
      again = true;
      break;
    }
  }
  return out.map(m => m.toString());
}

// ─────────────────────────────────────────────────────────────────────────────
// 每个 case 的方案
// ─────────────────────────────────────────────────────────────────────────────

interface CasePlan {
  c: AlgCase;
  before: SlotInfo;
  /** 抽掉转体后的 setup(等价于 `原 setup · y^-ypow`) */
  stripped: string;
  ypow: number;
  /** 挪槽用的 y 次数 */
  m: number;
  /** 公式统一用的 y 次数 = (m - ypow) mod 4 */
  t: number;
  setupNew: string;
  after: SlotInfo;
  algsNew: AlgEntry[][];
  /** 四向版本:`algs[k] = R_k(algs[0])`,k = 0..3 对应 FR / FL / BL / BR */
  algsFour: AlgEntry[][];
  /** `standard` 也是公式,面标变了要一起重贴 */
  standardNew: string | null;
  /** 剥掉了几条公式的孤儿前导转体 */
  orphans: number;
  notes: string[];
}

function planCase(c: AlgCase): CasePlan {
  const notes: string[] = [];
  const setup0 = toMoveString(c.setup || '');
  const before = inspect(apply(setup0));

  const { moves: stripped, ypow } = stripRotations(setup0);
  // 实证:抽转体后的 pattern 必须 == 原 pattern 再补一个 y^-ypow
  if (!eqPattern(apply(stripped), apply(`${setup0} ${YPOW_INV[ypow]}`))) {
    throw new Error(`strip-rotation 不等价: ${c.subgroup}/${c.name}`);
  }

  // 挪槽:实测哪个 m 把破槽送到 FR(不推公式,直接枚举 4 个)
  let m = -1;
  for (let k = 0; k < 4; k++) {
    const info = inspect(apply(relabel(stripped, k)));
    if (info.geom.length === 1 && info.geom[0] === 'FR') { m = k; break; }
  }
  if (m < 0) { notes.push('找不到把槽送到 FR 的 y 次数(多槽/异常 case)'); m = 0; }

  const setupNew = relabel(stripped, m);
  const after = inspect(apply(setupNew));
  const t = ((m - ypow) % 4 + 4) % 4;

  // setup' 与 `y^-m · stripped · y^m` 必须是同一个 pattern —— y 共轭等价性
  if (!eqPattern(apply(setupNew), apply(`${YPOW_INV[m]} ${stripped} ${YPOW[m]}`))) {
    throw new Error(`y 共轭不等价: ${c.subgroup}/${c.name}`);
  }

  let orphans = 0;
  const algsNew: AlgEntry[][] = c.algs.map(group => group.map(entry => {
    // 抽掉 setup 的 `y^ypow` 之后,公式里专门用来抵消它的那个前导转体就成了孤儿 ——
    // 上游把负号子组录成「setup 转到 FL 展示 + 公式开头先转回来」,两者本是一对,
    // 只抽 setup 那半边等于归一做了一半(槽在 FR,公式却要先空转一下才动)。
    //
    // 只剥**恰好等于 y^-ypow** 的前缀:多公式 case 里别的 y 前缀是上游有意的视角变体
    // (`A+/VP` 五条公式各带不同前缀,f2l 库里同样有),一律清会把它们毁掉。
    //
    // 剥掉之后重贴用 `R_m` 而不是 `R_t`,推导:
    //   原始 `S·y^a · (y^-a·X)` 解(S = stripped,a = ypow)
    //   目标 `R_m(S) · X''` 解
    //   y^-a·Y ~ R_a(Y)·y^-a,末尾整体转体判据容忍 ⟹ X'' = R_{a+t}(X) = R_m(X)
    const stripped2 = ypow !== 0 ? stripLeadRot(entry.alg, (4 - ypow) % 4) : null;
    const src = stripped2 ?? entry.alg;
    const k = stripped2 ? m : t;
    if (stripped2) orphans++;
    if (k === 0 && src === entry.alg) return entry;  // 不动的 case 连字符串都不重写
    const out = k === 0 ? src : relabelPreserving(src, k);
    // 保留版必须和 leaf-move 版逐招相等 —— 记号保住了,招式一个不能差
    if (toMoveString(out) !== relabel(toMoveString(src), k)) {
      throw new Error(`保留记号的重贴与 leaf-move 版不一致: ${c.subgroup}/${c.name} "${src}" → "${out}"`);
    }
    const e: AlgEntry = { ...entry, alg: out };
    // algHtml 里带上游的 <u>/<em> 标注,面标一变就对不上原文了 —— 丢掉,前端回退到纯文本
    if (e.algHtml) { delete (e as { algHtml?: string }).algHtml; }
    return e;
  }));
  if (t !== 0 && c.algs.some(g => g.some(e => e.algHtml))) notes.push('丢弃 algHtml(面标已变)');

  // `standard` 也是一条公式(`(↓R U' R U) (B U' B' R2')`)—— 缩略图 fallback
  // (`algs.flat()[0]?.alg ?? sample.standard`)和 `.alg-case-standard` 展示都吃它。
  // 面标一变它就指向旧朝向,必须跟 algs 一起重贴。
  let standardNew = c.standard ?? null;
  if (standardNew) {
    const s2 = ypow !== 0 ? stripLeadRot(standardNew, (4 - ypow) % 4) : null;
    const src = s2 ?? standardNew;
    const k = s2 ? m : t;                            // 同 algs:剥了孤儿前缀就用 R_m
    if (!(k === 0 && src === standardNew)) {
      const out = k === 0 ? src : relabelPreserving(src, k);
      if (toMoveString(out) !== relabel(toMoveString(src), k)) {
        throw new Error(`standard 重贴与 leaf-move 版不一致: ${c.subgroup}/${c.name} "${src}" → "${out}"`);
      }
      standardNew = out;
    }
  }

  // 四向:归一到 FR 之后 `algs[k] = R_k(algs[0])` 是纯机械产物(fourWayProbe 把显示、
  // 校验两条消费路径都校过)。原本就多组的 case 不生成 —— 目前 zbls/wv 全是 1 组。
  if (algsNew.length !== 1) notes.push(`原有 ${algsNew.length} 组公式,跳过四向生成`);
  const algsFour: AlgEntry[][] = algsNew.length === 1
    ? [0, 1, 2, 3].map(k => algsNew[0].map(e => (k === 0 ? e : { ...e, alg: relabelPreserving(e.alg, k) })))
    : algsNew;

  if (orphans) notes.push(`剥掉 ${orphans} 条公式的孤儿前导转体`);

  return { c, before, stripped, ypow, m, t, setupNew, after, algsNew, algsFour, standardNew, orphans, notes };
}

// ─────────────────────────────────────────────────────────────────────────────
// 四向升级预演(只算不写)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 归一到 FR 之后,四向数据就是纯机械产物:`algs[k] = R_k(algs[0])`。
 * 站上有**两条**消费路径,朝向语义**不是同一个式子**,所以两条都要校:
 *   - 显示 / 播放:`AlgCategoryView.oriAdjustSetup` = `setup y^k`(尾乘转体)
 *   - 校验扫描  :`alg_validation.setupForCase`   = `y^-k setup y^k`(共轭)
 * 两者差一个整体转体,而 f2l 系判据自带 24 朝向容忍 —— 这里实测它俩都过。
 */
function fourWayProbe(plans: CasePlan[], set: string): number {
  let okDisp = 0, badDisp = 0, okVal = 0, badVal = 0;
  const bad: string[] = [];
  for (const p of plans) {
    for (let k = 1; k <= 3; k++) {
      const dispSetup = `${p.setupNew} ${YPOW[k]}`.trim();     // oriAdjustSetup
      const valSetup = `${YPOW_INV[k]} ${p.setupNew} ${YPOW[k]}`.trim(); // setupForCase
      // 校的就是要写进库的那份数据本身,不另算一遍 —— 免得校验和落库两套式子悄悄分叉
      for (const entry of p.algsFour[k] ?? []) {
        const d = validate(dispSetup, entry, p.c.sticker, set);
        if (d.ok) okDisp++; else { badDisp++; bad.push(`disp ori${k} ${p.c.subgroup}/${p.c.name} "${entry.alg}" — ${d.reason}`); }
        const v = validate(valSetup, entry, p.c.sticker, set);
        if (v.ok) okVal++; else { badVal++; bad.push(`val  ori${k} ${p.c.subgroup}/${p.c.name} "${entry.alg}" — ${v.reason}`); }
      }
    }
  }
  console.log(`\n[四向] algs[k] = R_k(algs[0]) 生成 ${okDisp + badDisp} 条(ori 1..3)`);
  console.log(`[四向] 显示路径 setup+y^k     : ${okDisp}/${okDisp + badDisp} 通过`);
  console.log(`[四向] 校验路径 y^-k setup y^k: ${okVal}/${okVal + badVal} 通过`);
  for (const b of bad.slice(0, 20)) console.log(`    ${b}`);
  if (bad.length > 20) console.log(`    …还有 ${bad.length - 20} 条`);
  return badDisp + badVal;
}

// ─────────────────────────────────────────────────────────────────────────────
// 下游:LSLL 交叉引用(lib/lsll/zbls_algs.json)会不会跟着漂
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `gen-lsll-zbls-overlay.mts` 的 `keyOfSetup` —— 原样复用真模型,只是这里同时算新旧两版
 * setup 的 key 再 diff。key 不变 = 那条链和 `tests/lsll_zbls_overlay.test.ts` 都不受影响。
 */
const lsll = (() => {
  const { solvedCube, extractLsll, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX } =
    require('../lib/lsll/cube333.ts') as typeof import('../lib/lsll/cube333.ts');
  const { canonicalKey, keyToString } = require('../lib/lsll/model.ts') as typeof import('../lib/lsll/model.ts');
  const PRE = ['', "y'", 'y2', 'y'], POST = ['', 'y', 'y2', "y'"];
  const toCube333 = (d: any) => {
    const cube = solvedCube();
    for (let i = 0; i < 8; i++) {
      cube.cp[i] = CUBING_CORNER_INDEX.indexOf(d.CORNERS.pieces[CUBING_CORNER_INDEX[i]] as never);
      cube.co[i] = d.CORNERS.orientation[CUBING_CORNER_INDEX[i]];
    }
    for (let i = 0; i < 12; i++) {
      cube.ep[i] = CUBING_EDGE_INDEX.indexOf(d.EDGES.pieces[CUBING_EDGE_INDEX[i]] as never);
      cube.eo[i] = d.EDGES.orientation[CUBING_EDGE_INDEX[i]];
    }
    return cube;
  };
  return function keyOfSetup(setup: string): string | null {
    let moves: string;
    try { moves = toMoveString(setup || ''); } catch { return null; }
    for (let k = 0; k < 4; k++) {
      let p: KPattern;
      try { p = apply(`${PRE[k]} ${moves} ${POST[k]}`.trim()); } catch { return null; }
      for (const r of ROTS) {
        const q = r ? p.applyAlg(new Alg(r)) : p;
        const d = q.patternData;
        if (!(d.CENTERS.pieces as number[]).every((v, i) => v === i)) continue;
        const got = extractLsll(toCube333(d));
        if ('broken' in got) continue;
        return keyToString(canonicalKey(got.state));
      }
    }
    return null;
  };
})();

function lsllKeyDiff(plans: CasePlan[]): void {
  let same = 0; const moved: string[] = []; const lost: string[] = [];
  for (const p of plans) {
    const a = lsll(p.c.setup || ''), b = lsll(p.setupNew);
    if (a && b && a === b) same++;
    else if (!b) lost.push(`${p.c.subgroup}/${p.c.name}: 新 setup 提不出 LSLL key`);
    else moved.push(`${p.c.subgroup}/${p.c.name}: ${a} → ${b}`);
  }
  console.log(`\n[下游] lib/lsll/zbls_algs.json 的 canonical key:不变 ${same} / ${plans.length}`);
  for (const m of moved) console.log(`    漂移 ${m}`);
  for (const m of lost) console.log(`    丢失 ${m}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
const ORI_NAMES = ['Front Right', 'Front Left', 'Back Left', 'Back Right'];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const VERBOSE = argv.includes('--verbose');
const FOUR = argv.includes('--four');
/** 唯一的写路径。key 从环境变量取,**不落命令行**(命令行会进 shell history)。 */
const SEND = argv.includes('--send');
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? '';
/** server 是 30 次 / 60 秒(按 IP);2.1s 间隔留一成余量。 */
/**
 * `--from=<file>`(`{set}` 会被替换成 set 名)从本地 JSON 读输入,而不是 GET 线上。
 *
 * 归一依赖的关键信息是 setup 里那个整体转体(`ypow`)—— **一旦落库它就没了**。
 * 中途改了规则要重跑,必须拿落库前的备份当输入,否则孤儿前缀判据(依赖 ypow)静默失效。
 */
const FROM = argv.find(a => a.startsWith('--from='))?.slice('--from='.length);
const RATE_WINDOW_MS = 60_000;
const THROTTLE_MS = Number(argv.find(a => a.startsWith('--throttle='))?.slice('--throttle='.length) ?? 2100);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const SETS = (argv.find(a => a.startsWith('--set='))?.slice('--set='.length) ?? 'zbls,wv').split(',').filter(Boolean);

/**
 * `lib/alg_validation.ts` 的 3x3 f2l 系分支,逐字照抄:
 * 记号先过 `toMoveString`;末尾多余的 AUF 直接拦(f2l 系判据不看顶层);目标态用真的
 * `reachesGoal`(自带 24 朝向容忍)。
 */
function validate(setup: string, entry: AlgEntry, sticker: AlgSticker, set: string): { ok: boolean; reason?: string } {
  const goal = goalOf('3x3', set, sticker.kind);
  if (goal === 'skip') return { ok: true };
  if (!entry.alg.trim()) return { ok: true };
  let cleanAlg: string, cleanSetup: string, leaf: Move[];
  try {
    cleanAlg = toMoveString(entry.alg);
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

async function run(set: string): Promise<void> {
  const t0 = Date.now();
  const from = FROM?.replace('{set}', set);
  const file: { cases: AlgCase[] } = from
    ? JSON.parse(readFileSync(from, 'utf8'))
    : await (await fetch(`${API}/${set}?fresh=${Date.now()}`)).json();
  if (from) console.log(`\n[输入] ${from}(本地备份,不是线上)`);
  console.log(`\n${'='.repeat(78)}\n== 3x3/${set} —— ${file.cases.length} 个 case\n${'='.repeat(78)}`);

  const plans: CasePlan[] = [];
  const failures: string[] = [];
  for (const c of file.cases) {
    try { plans.push(planCase(c)); }
    catch (e) { failures.push(`${c.subgroup}/${c.name}: ${(e as Error).message}`); }
  }

  // ① 盘点
  const tally = (pick: (p: CasePlan) => string) => {
    const m = new Map<string, number>();
    for (const p of plans) m.set(pick(p), (m.get(pick(p)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ');
  };
  const slotOf = (i: SlotInfo) => (i.geom.length === 1 ? i.geom[0] : `${i.geom.length}槽[${i.geom.join('+')}]`);

  console.log(`\n[盘点] 槽位(渲染几何位): ${tally(p => slotOf(p.before))}`);
  console.log(`[盘点] 槽位(颜色框架)  : ${tally(p => (p.before.color.length === 1 ? p.before.color[0] : `${p.before.color.length}槽`))}`);
  console.log(`[盘点] setup 残留转体   : ${tally(p => p.before.residual || '(无)')}`);
  console.log(`[盘点] 底十字完好       : ${tally(p => (p.before.crossOk ? 'yes' : 'NO'))}`);
  console.log(`[盘点] 需要的 y 次数 m  : ${tally(p => `m=${p.m}`)}`);
  console.log(`[盘点] 剥掉的孤儿前缀   : ${plans.reduce((n, p) => n + p.orphans, 0)} 条公式,涉及 ${plans.filter(p => p.orphans).length} 个 case`);
  console.log(`[盘点] 归一后槽位       : ${tally(p => slotOf(p.after))}`);
  console.log(`[盘点] 归一后残留转体   : ${tally(p => p.after.residual || '(无)')}`);
  // 「要改」以**库里那个字符串**为准:setupNew 是重新序列化过的,记号规整(`ML'` → `M L'`)
  // 也算一次落库改动,不能拿 toMoveString(旧值) 当基准把它抹掉
  const changed = plans.filter(p => p.setupNew !== (p.c.setup || '').trim() || p.t !== 0);
  console.log(`[盘点] 需要改写的 case  : ${changed.length} / ${plans.length}`);

  // 改动分三档 —— 第 1 档只是记号规整(`ML'` → `M L'`),第 2 档只动 setup,第 3 档连公式一起动
  const kindOf = (p: CasePlan) => {
    const raw = toMoveString(p.c.setup || '');
    if (p.t !== 0) return 'C 挪槽(setup + 全部公式都改)';
    if (p.setupNew !== raw) return p.ypow !== 0 ? 'B 只抽整体转体(公式一字不改)' : 'A 只是记号规整(语义不变)';
    if (raw !== (p.c.setup || '').trim()) return 'A 只是记号规整(语义不变)';
    return '不动';
  };
  const byKind = new Map<string, number>();
  for (const p of plans) byKind.set(kindOf(p), (byKind.get(kindOf(p)) ?? 0) + 1);
  for (const [k, v] of [...byKind].sort()) console.log(`[分档] ${k}: ${v}`);

  if (failures.length) {
    console.log(`\n[!] ${failures.length} 个 case 规划失败:`);
    for (const f of failures) console.log(`    ${f}`);
  }

  // ② 逐 case 对照
  if (VERBOSE) {
    console.log(`\n[对照] subgroup | name | 旧槽 | 旧 setup  →  新 setup (m/t)`);
    for (const p of plans) {
      const mark = p.setupNew === toMoveString(p.c.setup || '') && p.t === 0 ? ' ' : '*';
      console.log(`  ${mark} ${p.c.subgroup} | ${p.c.name} | ${slotOf(p.before)}${p.before.residual ? `+${p.before.residual}` : ''} | ${p.c.setup}  →  ${p.setupNew}  (m=${p.m} t=${p.t})${p.notes.length ? '  ' + p.notes.join(';') : ''}`);
    }
  }

  // ③ 校验:旧数据 baseline + 新数据
  let oldOk = 0, oldBad = 0, newOk = 0, newBad = 0;
  const newBadList: string[] = [];
  const oldBadList: string[] = [];
  let done = 0;
  for (const p of plans) {
    const oldSetup = p.c.setup || '';
    // 第 gi 组是第 gi 个朝向的公式,配的 setup 是 `setup y^gi`(= 前端 oriAdjustSetup)。
    // 单组数据 gi 只到 0,后缀为空 —— 两种形状同一套式子。**脚本可重跑**靠的就是这个:
    // 已经四向化过的 case 再跑一遍时,库里就是 4 组,拿 FR 的 setup 去校 FL/BL/BR 必然全错。
    const oriSetup = (base: string, gi: number) => (gi === 0 ? base : `${base} ${YPOW[gi]}`.trim());
    for (let gi = 0; gi < p.c.algs.length; gi++) {
      for (let ai = 0; ai < p.c.algs[gi].length; ai++) {
        const before = validate(oriSetup(oldSetup, gi), p.c.algs[gi][ai], p.c.sticker, set);
        if (before.ok) oldOk++; else { oldBad++; oldBadList.push(`${p.c.subgroup}/${p.c.name} [${gi}][${ai}] "${p.c.algs[gi][ai].alg}" — ${before.reason}`); }
        const after = validate(oriSetup(p.setupNew, gi), p.algsNew[gi][ai], p.c.sticker, set);
        if (after.ok) newOk++; else { newBad++; newBadList.push(`${p.c.subgroup}/${p.c.name} [${gi}][${ai}] "${p.algsNew[gi][ai].alg}" (setup ${oriSetup(p.setupNew, gi)}) — ${after.reason}`); }
      }
    }
    if (++done % 50 === 0) console.log(`    …校验 ${done}/${plans.length} case (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const pct = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(2)}%`);
  console.log(`\n[校验] 改写前 : ${oldOk}/${oldOk + oldBad} 通过 (${pct(oldOk, oldOk + oldBad)})`);
  console.log(`[校验] 改写后 : ${newOk}/${newOk + newBad} 通过 (${pct(newOk, newOk + newBad)})`);
  if (oldBadList.length) {
    console.log(`\n[校验] 改写前就不过的 ${oldBadList.length} 条:`);
    for (const b of oldBadList) console.log(`    ${b}`);
  }
  if (newBadList.length) {
    console.log(`\n[校验] 改写后不过的 ${newBadList.length} 条:`);
    for (const b of newBadList) console.log(`    ${b}`);
  }

  // ③b `standard` 单独校 —— 它不在上面那圈里(库里存的是**剥掉起手 AUF** 的版本),
  // 所以枚举起手 AUF 再喂 validate;旧值同样跑一遍当 baseline,免得把上游本来就
  // 不过的条目记在重贴头上。
  // 剥掉的**不只是** AUF:`C-/C T'` 的 alg0 = `y U' (↓L' U L' U') (B' U B L2)`,
  // standard 是它去掉 `y U'` 的部分 —— 转体前缀也被剥了。所以前缀要枚举 y^j·U^i 全 16 种。
  const STD_PREFIX = ['', 'y', 'y2', "y'"].flatMap(y => ['', 'U', 'U2', "U'"].map(u => `${y} ${u}`.trim()));
  const stdOk = (setup: string, std: string, c: AlgCase): boolean =>
    STD_PREFIX.some(pre => validate(setup, { alg: `${pre} ${std}`.trim() }, c.sticker, set).ok);
  let stdNewOk = 0;
  const stdOldBadSet = new Set<string>();
  const stdBadList: string[] = [];
  for (const p of plans) {
    if (!p.c.standard) continue;
    const key = `${p.c.subgroup}/${p.c.name}`;
    if (!stdOk(p.c.setup || '', p.c.standard, p.c)) stdOldBadSet.add(key);
    if (p.standardNew && stdOk(p.setupNew, p.standardNew, p.c)) stdNewOk++;
    else stdBadList.push(`${key} standard "${p.standardNew}" (setup ${p.setupNew}, t=${p.t})${stdOldBadSet.has(key) ? '  ← 改写前也不过' : '  ← **重贴引入的**'}`);
  }
  const stdTotal = plans.filter(p => p.c.standard).length;
  // 关键判据不是「有几条不过」,而是「改写有没有**新**弄坏一条」—— 上游本来就不过的
  // 不该记在重贴头上,但也绝不能拿它当挡箭牌把新坏的混进去
  const stdRegressed = stdBadList.filter(b => b.includes('重贴引入的')).length;
  console.log(`\n[standard] 改写前不过 : ${stdOldBadSet.size}/${stdTotal}`);
  console.log(`[standard] 改写后通过 : ${stdNewOk}/${stdTotal}(其中重贴新引入的坏条目 ${stdRegressed} 条)`);
  for (const b of stdBadList.slice(0, 20)) console.log(`    ${b}`);
  if (stdBadList.length > 20) console.log(`    …还有 ${stdBadList.length - 20} 条`);

  // ④ 四向:algs[k] = R_k(algs[0]),显示 / 校验两条消费路径各校一遍。
  //    `--send` 时**强制**跑 —— 它是落库的前置闸,不能跳。
  const fourBad = FOUR || SEND ? fourWayProbe(plans, set) : 0;

  // ⑤ 下游影响:lib/lsll/zbls_algs.json 的 key 会不会漂
  if (set === 'zbls') lsllKeyDiff(plans);

  // ⑥ 落库。四向升级让**每个** case 的 algs 都从 1 组变 4 组,所以要写的是全部
  //    case,不只是 setup 变了的那批。
  const bodyOf = (p: CasePlan) => ({
    caseName: p.c.name,
    subgroup: p.c.subgroup ?? '',
    setup: p.setupNew,
    standard: p.standardNew,
    sticker: p.c.sticker,
    algs: p.algsFour,
    oriNames: p.algsFour.length === 4 ? ORI_NAMES : p.c.oriNames ?? null,
    trainerKey: p.c.trainerKey ?? null,
  });

  if (SEND) {
    // 闸门:任何一档校验没过就整批不发 —— 宁可不写,不写半套
    const blockers: string[] = [];
    if (!ADMIN_KEY) blockers.push('缺 ADMIN_API_KEY 环境变量');
    if (failures.length) blockers.push(`${failures.length} 个 case 规划失败`);
    if (newBad > 0) blockers.push(`归一后 ${newBad} 条公式校验不过`);
    // 只拦**重贴新引入的** —— 上游本来就不匹配的 standard 改写前后一样坏,拦它等于永远发不出去
    if (stdRegressed > 0) blockers.push(`重贴新弄坏了 ${stdRegressed} 条 standard`);
    if (fourBad > 0) blockers.push(`四向生成 ${fourBad} 条校验不过`);
    if (plans.some(p => p.algsFour.length !== 4)) blockers.push('有 case 没生成满 4 组公式');
    if (plans.some(p => !p.c.id)) blockers.push('有 case 缺 id');
    if (blockers.length) {
      console.log(`\n[send] 拒绝发送 —— ${blockers.join(';')}`);
      process.exitCode = 1;
      return;
    }

    // server 端 `checkRateLimit` 是**按 IP** 60 秒 30 次(`recon_helpers.ts` 的
    // RATE_WINDOW / RATE_MAX)。305 个 case 必须节流,否则第 30 个之后全 429。
    const eta = (plans.length * THROTTLE_MS / 1000 / 60).toFixed(1);
    console.log(`\n[send] 闸门全过。串行 PUT ${plans.length} 个 case,间隔 ${THROTTLE_MS}ms(限流 30 次/60s),预计 ${eta} 分钟…`);
    let sent = 0;
    const sendFail: string[] = [];
    for (const p of plans) {
      let done = false;
      for (let attempt = 1; attempt <= 4 && !done; attempt++) {
        let res: Response;
        try {
          res = await fetch(`${API}/${set}/cases/${p.c.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
            body: JSON.stringify(bodyOf(p)),
          });
        } catch (e) {
          if (attempt === 4) { sendFail.push(`${p.c.subgroup}/${p.c.name} (id=${p.c.id}) → 网络错误 ${(e as Error).message}`); done = true; }
          else await sleep(5_000);
          continue;
        }
        if (res.ok) { sent++; done = true; break; }
        if (res.status === 429 && attempt < 4) {
          // 撞了就等整个窗口过去 —— 退避比缩短间隔可靠,反正是一次性迁移
          console.log(`    [429] ${p.c.name} 撞限流,等 ${RATE_WINDOW_MS / 1000}s 重试(第 ${attempt} 次)`);
          await sleep(RATE_WINDOW_MS);
          continue;
        }
        sendFail.push(`${p.c.subgroup}/${p.c.name} (id=${p.c.id}) → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        done = true;
      }
      const n = sent + sendFail.length;
      if (n % 25 === 0) console.log(`    …已发 ${n}/${plans.length}(成功 ${sent},${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      await sleep(THROTTLE_MS);
    }
    console.log(`\n[send] 发送完成:${sent}/${plans.length} 成功`);
    for (const f of sendFail.slice(0, 20)) console.log(`    失败 ${f}`);

    // 回读复核 —— HTTP 200 不等于库里就是那份数据,逐字段比一遍才算落库成功
    const back: { cases: AlgCase[] } = await (await fetch(`${API}/${set}?fresh=${Date.now()}`)).json();
    const byId = new Map(back.cases.map(c => [c.id, c]));
    let verified = 0;
    const drift: string[] = [];
    for (const p of plans) {
      const got = byId.get(p.c.id);
      const want = bodyOf(p);
      if (!got) { drift.push(`${p.c.name}: 回读不到 id=${p.c.id}`); continue; }
      const flat = (a: AlgEntry[][]) => JSON.stringify(a.map(g => g.map(e => e.alg)));
      if (got.setup !== want.setup) drift.push(`${p.c.name}: setup 库里 "${got.setup}" ≠ 期望 "${want.setup}"`);
      else if (flat(got.algs) !== flat(want.algs)) drift.push(`${p.c.name}: algs 与期望不一致`);
      else if (JSON.stringify(got.oriNames ?? null) !== JSON.stringify(want.oriNames)) drift.push(`${p.c.name}: oriNames 库里 ${JSON.stringify(got.oriNames)}`);
      else if ((got.standard ?? null) !== want.standard) drift.push(`${p.c.name}: standard 库里 ${JSON.stringify(got.standard)}`);
      else verified++;
    }
    console.log(`[send] 回读复核:${verified}/${plans.length} 逐字段与预期一致`);
    for (const d of drift.slice(0, 20)) console.log(`    ${d}`);
  } else if (APPLY) {
    console.log(`\n[apply] 以下 ${plans.length} 个 PUT **没有发出**(只打印;setup 变了的有 ${changed.length} 个,其余是四向升级):`);
    for (const p of plans.slice(0, 5)) {
      console.log(`  PUT ${API}/${set}/cases/${p.c.id}   [X-Admin-Key]`);
      console.log(`      ${JSON.stringify(bodyOf(p))}`);
    }
    if (plans.length > 5) console.log(`  …剩下 ${plans.length - 5} 个同构,略`);
    console.log(`\n[apply] 真要写库加 --send(需要 ADMIN_API_KEY 环境变量)。`);
  } else {
    console.log(`\n[dry-run] 没有发出任何写请求。--apply 预览请求,--send 真写。`);
  }
  console.log(`[time] ${set}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

selfTestRelabel(kpuzzle);
for (const s of SETS) await run(s);
