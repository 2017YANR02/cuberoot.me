/*
 * lsll-corpus — 生成批量求解管道的语料,两个文件、两个阶段:
 *
 *   corpus.txt       148,384 行 —— 站上「两步路线」那批(先跑这个)
 *   corpus_rest.txt  434,900 行 —— 其余全部,凑满 583,284 = 整个 LSLL 空间(后跑)
 *
 * 分两个文件而不是一个,是为了让求解能**分两趟**跑:`node solve_loop.mjs` 只啃第一批,
 * 完了再 `CORPUS=corpus_rest.txt node solve_loop.mjs` 啃第二批(同一个 out.csv,按 key 续跑)。
 * 进度条各自有自己的分母,不会把 6 小时的第二批混进第一批的 ETA 里。
 *
 * ── 阶段 A(corpus.txt):两步路线 ────────────────────────────────
 * 302 条已收录 ZBLS case × 494 个 ZBLL 收尾 = 149,188 条路线,去重后 **148,384 个 canonical
 * key**(804 条撞在一起 —— 6 个 ZBLS 构型自带 pre-AUF 稳定子,见 /math/lsll §3)。
 *
 * 怎么造打乱:**不是**给 148,384 个局面各解一次(那要跑十几分钟还得看 cubing.js 脸色),
 * 而是只解 302 + 494 = 796 次,剩下的全是字符串拼接:
 *
 *   composeState(zbll, zbls) = 「先摆成 zbll,再施加从全解走到 zbls 的那串转动」
 *   ⇒ scramble(route) = setup(zbll) + ' ' + setup(zbls)
 *
 * 拼完**逐条回放校验**(本地 cube333 模型重算 canonical key,与 composeState 的结果比对),
 * 149,188 条一条不漏 —— 拼接顺序错了会当场炸,不会把坏语料喂进 10 小时的求解。
 *
 * 打乱长度不重要(~40 步):最优解器只关心它到达的**局面**,输入多长都一样。
 *
 * ── 阶段 B(corpus_rest.txt):其余 434,900 个 ─────────────────────
 * 剩下的局面不是两条已收录 case 拼出来的,拼接那招用不上;但也**不需要**逐个跑两阶段
 * (43 万 × ~100ms ≈ 12 小时)。走 `lsll-scramble-bfs.mts`:9 个保槽生成元对整个 9,331,200
 * 原始态做一次 BFS(~5s),之后每个局面回溯即得打乱。同样逐条回放校验。
 *
 * 42 个大类枚举出来的 canonical key 合起来 = 583,284(含 O 类那 3,916 个纯顶层局面 —— LSLL
 * 页面不列它们,但「粘打乱定位 case」会撞上,顺手算掉);减去阶段 A 的 148,384 = 434,900。
 *
 * Run: NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts
 *      加 --routes-only 只出阶段 A(想省两分钟时用)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { buildLsllScrambler } from './lsll-scramble-bfs.mts';

// Node ≥23 的原生 .ts 剥离会抢在 tsx 的 loader 前面 —— 与 gen-lsll-*.mts 同样走 createRequire。
const require = createRequire(import.meta.url);
const {
  applyAlg, embedLsll, extractLsll, solvedCube, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX,
} = require('../lib/lsll/cube333.ts') as typeof import('../lib/lsll/cube333.ts');
type LsllState = import('../lib/lsll/cube333.ts').LsllState;
const {
  CATEGORIES, TOTAL_CASES, canonicalKey, classify, composeState, decodeKey, displayState,
  enumerateCategory, keyFromString, keyToString, packState, unpackState,
} = require('../lib/lsll/model.ts') as typeof import('../lib/lsll/model.ts');
const { zbllRoundKeys } = require('../lib/lsll/class3.ts') as typeof import('../lib/lsll/class3.ts');
const { ZBLS_COVERED_KEYS } = require('../lib/lsll/zbls_overlay.ts') as typeof import('../lib/lsll/zbls_overlay.ts');

const solverDir = fileURLToPath(new URL('../../../../solver/lsll/', import.meta.url));
const OUT = path.resolve(solverDir, 'corpus.txt');
const OUT_REST = path.resolve(solverDir, 'corpus_rest.txt');
const ROUTES_ONLY = process.argv.includes('--routes-only');

/** 局面 → 一条到达它的纯面转打乱(cubing.js 两阶段解取逆),带回放失安全。 */
const kpuzzle = await cube3x3x3.kpuzzle();
async function setupFor(state: LsllState): Promise<string> {
  const full = embedLsll(state);
  const data = structuredClone(kpuzzle.defaultPattern().patternData);
  for (let i = 0; i < 8; i++) {
    data.CORNERS.pieces[CUBING_CORNER_INDEX[i]] = CUBING_CORNER_INDEX[full.cp[i]];
    data.CORNERS.orientation[CUBING_CORNER_INDEX[i]] = full.co[i];
  }
  for (let i = 0; i < 12; i++) {
    data.EDGES.pieces[CUBING_EDGE_INDEX[i]] = CUBING_EDGE_INDEX[full.ep[i]];
    data.EDGES.orientation[CUBING_EDGE_INDEX[i]] = full.eo[i];
  }
  const solution = await experimentalSolve3x3x3IgnoringCenters(new KPattern(kpuzzle, data));
  const setup = solution.invert().toString().replace(/2'/g, '2');
  const back = extractLsll(applyAlg(solvedCube(), setup));
  if ('broken' in back || packState(back.state) !== packState(state)) {
    throw new Error(`setup verification failed for ${keyToString(canonicalKey(state))}`);
  }
  return setup;
}

// ---- 302 条已收录 ZBLS case(去掉 O 类:对子已归位 = 纯顶层 = 1LLL,LSLL 不收) ----
const zblsKeys = ZBLS_COVERED_KEYS
  .map((s) => keyFromString(s))
  .filter((k): k is number => k != null)
  .filter((k) => !classify(unpackState(k)).category.pureLL);
if (zblsKeys.length !== 302) throw new Error(`expected 302 zbls cases, got ${zblsKeys.length}`);

// ---- 494 个 ZBLL 收尾(第 1 个是全解顶层 = 纯 ZBLS) ----
const zbllKeys = zbllRoundKeys();
if (zbllKeys.length !== 494) throw new Error(`expected 494 zbll cases, got ${zbllKeys.length}`);

const t0 = Date.now();
const setups = new Map<number, string>();
let solved = 0;
for (const k of [...zblsKeys, ...zbllKeys]) {
  if (setups.has(k)) continue;
  setups.set(k, await setupFor(unpackState(k)));
  if (++solved % 50 === 0) process.stdout.write(`\r  两阶段解 ${solved}/${zblsKeys.length + zbllKeys.length}…`);
}
process.stdout.write(`\r  两阶段解 ${setups.size} 个基件,用时 ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

/**
 * 把打乱调到**展示相位**上。
 *
 * canonical key 认的是 16 个 AUF 像里最小的那个,而 case 页画的、用户看的是 `displayState`
 * (对子摆正的那个代表元)。拼出来的打乱落在轨道里的哪个像是随机的 —— 差一个 AUF,求出来的
 * 最优解贴到页面上就解不开。所以在这里就把它钉到展示相位上:16 种首尾 AUF 逐个回放取匹配的。
 * (U 碰不到 DFR / FR,补 AUF 不会把最后一槽转出去;补完长度最多 +2,对最优解器无影响。)
 */
const AUF = ['', 'U', 'U2', "U'"];
function toDisplayPhase(scramble: string, key: number): string {
  const target = packState(displayState(decodeKey(key)!));
  for (const pre of AUF) {
    for (const post of AUF) {
      const cand = [pre, scramble, post].filter(Boolean).join(' ');
      const back = extractLsll(applyAlg(solvedCube(), cand));
      if (!('broken' in back) && packState(back.state) === target) return cand;
    }
  }
  throw new Error(`${keyToString(key)}:16 种 AUF 都到不了展示相位`);
}

// ---- 拼 149,188 条路线,逐条回放校验,按 canonical key 去重 ----
const rows = new Map<number, string>();
let routes = 0;
for (const lk of zbllKeys) {
  const zbll = unpackState(lk);
  const head = setups.get(lk)!;
  for (const zk of zblsKeys) {
    const want = canonicalKey(composeState(zbll, unpackState(zk)));
    const scramble = head ? `${head} ${setups.get(zk)!}`.trim() : setups.get(zk)!;
    const back = extractLsll(applyAlg(solvedCube(), scramble));
    if ('broken' in back) throw new Error(`route ${keyToString(lk)}×${keyToString(zk)} 打乱破坏了十字/前三槽`);
    const got = canonicalKey(back.state);
    if (got !== want) {
      throw new Error(`route ${keyToString(lk)}×${keyToString(zk)}: 拼接得到 ${keyToString(got)},合成律给的是 ${keyToString(want)} —— 拼接顺序错了`);
    }
    routes++;
    if (!rows.has(got)) rows.set(got, toDisplayPhase(scramble, got));
  }
  if (zbllKeys.indexOf(lk) % 20 === 0) process.stdout.write(`\r  拼路线 ${routes}/${zbllKeys.length * zblsKeys.length}…`);
}
process.stdout.write(`\r  拼路线 ${routes} 条 → ${rows.size} 个 canonical key(重复 ${routes - rows.size})\n`);

if (routes !== 149188) throw new Error(`expected 149188 routes, got ${routes}`);
if (rows.size !== 148384) throw new Error(`expected 148384 distinct keys, got ${rows.size}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, [...rows].map(([k, s]) => `${keyToString(k)},${s}`).join('\n') + '\n');
const lengths = (ss: Iterable<string>) => {
  let lo = Infinity, hi = 0, sum = 0, n = 0;
  for (const s of ss) { const k = s.split(' ').length; if (k < lo) lo = k; if (k > hi) hi = k; sum += k; n++; }
  return `${lo}–${hi} 步(均 ${(sum / Math.max(1, n)).toFixed(1)})`;
};
console.log(`写出 ${OUT}`);
console.log(`  ${rows.size} 行,打乱 ${lengths(rows.values())}`);

if (ROUTES_ONLY) {
  console.log('\n--routes-only:阶段 B 跳过。');
  process.exit(0);
}

// ════ 阶段 B:其余 434,900 个 ════════════════════════════════════════
console.log('\n阶段 B:其余局面');

// 42 个大类枚举 → 整个空间的 canonical key。O 类(纯顶层)也算进来:页面不列它,
// 但「粘打乱定位 case」会撞上,3,916 个的成本可以忽略。
const t1 = Date.now();
const allKeys: number[] = [];
const seenKey = new Set<number>();
for (const cat of CATEGORIES) {
  for (const k of enumerateCategory(cat.slug)) {
    if (seenKey.has(k)) throw new Error(`${keyToString(k)} 同时属于两个大类 —— classify 有歧义`);
    seenKey.add(k);
    allKeys.push(k);
  }
}
console.log(`  枚举 ${allKeys.length} 个 case,用时 ${((Date.now() - t1) / 1000).toFixed(1)}s`);
if (allKeys.length !== TOTAL_CASES) throw new Error(`expected ${TOTAL_CASES} cases, got ${allKeys.length}`);

const restKeys = allKeys.filter((k) => !rows.has(k));
if (restKeys.length !== TOTAL_CASES - rows.size) {
  // 阶段 A 的 key 必须全在枚举里 —— 不在说明两条路对 canonical 的口径不一致
  throw new Error(`阶段 A 有 ${rows.size - (TOTAL_CASES - restKeys.length)} 个 key 不在大类枚举里`);
}
console.log(`  其余 ${restKeys.length} 个(= ${TOTAL_CASES} − ${rows.size})`);

const scrambler = buildLsllScrambler((m) => process.stdout.write(`${m}\r`));
process.stdout.write(`  BFS 覆盖 ${scrambler.coverage} 个原始态,最深 ${scrambler.depthHistogram.length - 1} 层,`
  + `用时 ${(scrambler.buildMs / 1000).toFixed(1)}s\n`);

// 逐条:展示相位 → 回溯打乱 → **回放校验**(与阶段 A 同一套失安全:坏语料绝不喂进十几小时的求解)
const CHUNK = 20_000;
let buf: string[] = [];
let lo = Infinity, hi = 0, sum = 0;
fs.writeFileSync(OUT_REST, '');
const t2 = Date.now();
for (let i = 0; i < restKeys.length; i++) {
  const key = restKeys[i];
  const want = displayState(decodeKey(key)!);
  const scramble = scrambler.scrambleFor(want);
  const back = extractLsll(applyAlg(solvedCube(), scramble));
  if ('broken' in back) throw new Error(`${keyToString(key)}:打乱破坏了十字/前三槽`);
  if (packState(back.state) !== packState(want)) {
    throw new Error(`${keyToString(key)}:回溯打乱到不了展示相位`);
  }
  if (canonicalKey(back.state) !== key) throw new Error(`${keyToString(key)}:canonical key 不符`);
  const n = scramble.split(' ').length;
  if (n < lo) lo = n; if (n > hi) hi = n; sum += n;
  buf.push(`${keyToString(key)},${scramble}`);
  if (buf.length >= CHUNK) {
    fs.appendFileSync(OUT_REST, buf.join('\n') + '\n');
    buf = [];
    const rate = (i + 1) / ((Date.now() - t2) / 1000);
    process.stdout.write(`\r  校验 ${i + 1}/${restKeys.length} · ${Math.round(rate)}/s…`);
  }
}
if (buf.length) fs.appendFileSync(OUT_REST, buf.join('\n') + '\n');
process.stdout.write(`\r  校验 ${restKeys.length} 条全部命中,用时 ${((Date.now() - t2) / 1000).toFixed(1)}s\n`);
console.log(`写出 ${OUT_REST}`);
console.log(`  ${restKeys.length} 行,打乱 ${lo}–${hi} 步(均 ${(sum / restKeys.length).toFixed(1)})`);
console.log(`\n两个文件合计 ${rows.size + restKeys.length} 个 case = 整个 LSLL 空间。`);
