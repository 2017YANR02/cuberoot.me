/*
 * lsll-corpus — 生成批量求解管道的语料:148,384 行 `base36key,scramble`。
 *
 * 范围 = 站上「两步路线」那批(PLAN.md「批量求解管道」):302 条已收录 ZBLS case × 494 个
 * ZBLL 收尾 = 149,188 条路线,去重后 **148,384 个 canonical key**(804 条撞在一起 —— 6 个
 * ZBLS 构型自带 pre-AUF 稳定子,见 /math/lsll §3)。其余 434,900 个局面不在这一轮。
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
 * Run: NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

// Node ≥23 的原生 .ts 剥离会抢在 tsx 的 loader 前面 —— 与 gen-lsll-*.mts 同样走 createRequire。
const require = createRequire(import.meta.url);
const {
  applyAlg, embedLsll, extractLsll, solvedCube, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX,
} = require('../lib/lsll/cube333.ts') as typeof import('../lib/lsll/cube333.ts');
type LsllState = import('../lib/lsll/cube333.ts').LsllState;
const {
  canonicalKey, classify, composeState, keyFromString, keyToString, packState, unpackState,
} = require('../lib/lsll/model.ts') as typeof import('../lib/lsll/model.ts');
const { zbllRoundKeys } = require('../lib/lsll/class3.ts') as typeof import('../lib/lsll/class3.ts');
const { ZBLS_COVERED_KEYS } = require('../lib/lsll/zbls_overlay.ts') as typeof import('../lib/lsll/zbls_overlay.ts');

const OUT = path.resolve(fileURLToPath(new URL('../../../../solver/lsll/corpus.txt', import.meta.url)));

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
    if (!rows.has(got)) rows.set(got, scramble);
  }
  if (zbllKeys.indexOf(lk) % 20 === 0) process.stdout.write(`\r  拼路线 ${routes}/${zbllKeys.length * zblsKeys.length}…`);
}
process.stdout.write(`\r  拼路线 ${routes} 条 → ${rows.size} 个 canonical key(重复 ${routes - rows.size})\n`);

if (routes !== 149188) throw new Error(`expected 149188 routes, got ${routes}`);
if (rows.size !== 148384) throw new Error(`expected 148384 distinct keys, got ${rows.size}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, [...rows].map(([k, s]) => `${keyToString(k)},${s}`).join('\n') + '\n');
let lo = Infinity, hi = 0, sum = 0;
for (const s of rows.values()) { const n = s.split(' ').length; if (n < lo) lo = n; if (n > hi) hi = n; sum += n; }
console.log(`写出 ${OUT}`);
console.log(`  ${rows.size} 行,打乱 ${lo}–${hi} 步(均 ${(sum / rows.size).toFixed(1)})`);
