/*
 * 给**任意** LSLL 局面造一条纯面转打乱 —— 一次 BFS 把 9,331,200 个原始态全走到,之后每个态
 * O(深度) 回溯即得,不用逐个跑 cubing.js 两阶段(43 万个 × ~100ms ≈ 12 小时)。
 *
 * 为什么能这么干:保住十字 + 前三槽的转动自己成一个群,而
 *
 *   U / U2 / U' · R U^k R' · F' U^k F   (k = 1,2,3)
 *
 * 这 9 条就把它生成完了(实测覆盖 9,331,200 / 9,331,200,BFS ~5s,最深 11 层)。
 * 别往里加 `R2 U R2` / `F U F'` / `R' U R` 这类:R2 会把 DRB 角送进顶层、F 会把 DLF 送进顶层,
 * 收不回来 —— `extractLsll` 会判 broken,建表时当场抛。
 *
 * 编号:cpIdx(120) × coIdx(81) × epIdx(120) × eoIdx(16) = 18,662,400,其中一半因角/棱置换
 * 奇偶必须一致而不合法(合法的正好 9,331,200 = (5!·5!/2)·3⁴·2⁴)。末位朝向由和推出,不进编号。
 *
 * 一个生成元对局面的作用可以分开看:角块只跟 (cp,co) 有关、棱块只跟 (ep,eo) 有关
 * (见 `model.composeState` 的合成律),所以每个生成元只要两张小表(9,720 + 1,920 项),
 * BFS 的每一步就是两次查表。
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applyAlg, extractLsll, solvedCube } =
  require('../lib/lsll/cube333.ts') as typeof import('../lib/lsll/cube333.ts');
type LsllState = import('../lib/lsll/cube333.ts').LsllState;

/** 保槽生成元。顺序即 BFS 展开顺序,改了会改所有打乱的字面(但不改正确性)。 */
export const SLOT_SAFE_GENERATORS = [
  'U', 'U2', "U'",
  "R U R'", "R U2 R'", "R U' R'",
  "F' U F", "F' U2 F", "F' U' F",
] as const;

/** 原始态总数 = (5!·5!/2)·3⁴·2⁴。BFS 必须正好走到这个数,少一个就说明生成元不够。 */
export const RAW_STATES = 9_331_200;

const FACT = [1, 1, 2, 6, 24, 120];
const CN = 120 * 81;      // 角:置换 × 朝向
const EN = 120 * 16;      // 棱:置换 × 朝向
const TOTAL = CN * EN;

function permIdx(p: readonly number[]): number {
  let idx = 0;
  for (let i = 0; i < 5; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 5; j++) if (p[j] < p[i]) smaller++;
    idx += smaller * FACT[4 - i];
  }
  return idx;
}

function permFrom(idx: number): number[] {
  const rest = [0, 1, 2, 3, 4], out: number[] = [];
  let n = idx;
  for (let i = 0; i < 5; i++) {
    const f = FACT[4 - i];
    out.push(rest.splice(Math.floor(n / f), 1)[0]);
    n %= f;
  }
  return out;
}

const cornerIdx = (s: LsllState) =>
  permIdx(s.cp) * 81 + (s.co[0] * 27 + s.co[1] * 9 + s.co[2] * 3 + s.co[3]);
const edgeIdx = (s: LsllState) =>
  permIdx(s.ep) * 16 + (s.eo[0] | (s.eo[1] << 1) | (s.eo[2] << 2) | (s.eo[3] << 3));

function cornerFrom(i: number): { cp: number[]; co: number[] } {
  const cp = permFrom(Math.floor(i / 81));
  const o = i % 81;
  const co = [Math.floor(o / 27), Math.floor(o / 9) % 3, Math.floor(o / 3) % 3, o % 3, 0];
  co[4] = (30 - co[0] - co[1] - co[2] - co[3]) % 3;
  return { cp, co };
}

function edgeFrom(i: number): { ep: number[]; eo: number[] } {
  const ep = permFrom(Math.floor(i / 16));
  const b = i % 16;
  const eo = [b & 1, (b >> 1) & 1, (b >> 2) & 1, (b >> 3) & 1, 0];
  eo[4] = (eo[0] + eo[1] + eo[2] + eo[3]) & 1;
  return { ep, eo };
}

/** 一条 alg 的两张作用表(角 / 棱)。alg 不保槽就抛。 */
function actionTables(alg: string): { c: Int32Array; e: Int32Array } {
  const got = extractLsll(applyAlg(solvedCube(), alg));
  if ('broken' in got) throw new Error(`生成元 ${alg} 破坏了十字/前三槽`);
  const g = got.state;
  const c = new Int32Array(CN), e = new Int32Array(EN);
  for (let i = 0; i < CN; i++) {
    const { cp, co } = cornerFrom(i);
    const ncp: number[] = [], nco: number[] = [];
    for (let p = 0; p < 5; p++) { ncp[p] = cp[g.cp[p]]; nco[p] = (co[g.cp[p]] + g.co[p]) % 3; }
    c[i] = permIdx(ncp) * 81 + (nco[0] * 27 + nco[1] * 9 + nco[2] * 3 + nco[3]);
  }
  for (let i = 0; i < EN; i++) {
    const { ep, eo } = edgeFrom(i);
    const nep: number[] = [], neo: number[] = [];
    for (let p = 0; p < 5; p++) { nep[p] = ep[g.ep[p]]; neo[p] = (eo[g.ep[p]] + g.eo[p]) % 2; }
    e[i] = permIdx(nep) * 16 + (neo[0] | (neo[1] << 1) | (neo[2] << 2) | (neo[3] << 3));
  }
  return { c, e };
}

/** `R U2 R'` → `R U2 R'` 的逆 `R U2 R'` 那种:逐字取逆再倒序。 */
function invertAlg(alg: string): string {
  return alg.split(/\s+/).reverse()
    .map(t => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`))
    .join(' ');
}

export interface LsllScrambler {
  /** 到达该局面的一条纯面转打乱(**就是这个相位**,不差 AUF)。 */
  scrambleFor: (state: LsllState) => string;
  /** BFS 覆盖的态数;应等于 {@link RAW_STATES}。 */
  coverage: number;
  /** 每层新增态数,`[1, 9, 54, …]`。 */
  depthHistogram: number[];
  /** 建表 + BFS 耗时(ms)。 */
  buildMs: number;
}

/**
 * 建 BFS 表。~19 MB 常驻(`Uint8Array`,每个态记「从哪个生成元来的」)+ 18 张小表。
 * 覆盖不足会当场抛 —— 宁可停在这里,也不要拿半个空间的语料去喂十几个小时的求解。
 */
export function buildLsllScrambler(log: (m: string) => void = () => {}): LsllScrambler {
  const t0 = Date.now();
  const gens = SLOT_SAFE_GENERATORS.map(alg => ({
    alg,
    fwd: actionTables(alg),
    back: actionTables(invertAlg(alg)),
  }));

  const ROOT = 255;
  const pred = new Uint8Array(TOTAL);   // 0 = 没走到;ROOT = 起点;否则 = 生成元下标 + 1
  const start = extractLsll(solvedCube());
  if ('broken' in start) throw new Error('全解态竟然 broken —— cube333 模型坏了');
  const root = cornerIdx(start.state) * EN + edgeIdx(start.state);
  pred[root] = ROOT;

  let frontier = new Int32Array([root]);
  const depthHistogram = [1];
  let coverage = 1;
  while (frontier.length) {
    const next = new Int32Array(frontier.length * gens.length);
    let n = 0;
    for (const cur of frontier) {
      const c = Math.floor(cur / EN), e = cur % EN;
      for (let g = 0; g < gens.length; g++) {
        const nx = gens[g].fwd.c[c] * EN + gens[g].fwd.e[e];
        if (pred[nx] === 0) { pred[nx] = g + 1; next[n++] = nx; }
      }
    }
    if (!n) break;
    frontier = next.subarray(0, n);
    coverage += n;
    depthHistogram.push(n);
    log(`  深 ${depthHistogram.length - 1}:+${n} → ${coverage}`);
  }
  if (coverage !== RAW_STATES) {
    throw new Error(`BFS 只覆盖 ${coverage} / ${RAW_STATES} —— 生成元不足,别拿这份表造语料`);
  }

  const scrambleFor = (state: LsllState): string => {
    let cur = cornerIdx(state) * EN + edgeIdx(state);
    const parts: string[] = [];
    while (pred[cur] !== ROOT) {
      const g = pred[cur] - 1;
      if (g < 0) throw new Error('这个局面不在 BFS 里 —— 非法态?');
      parts.push(gens[g].alg);
      cur = gens[g].back.c[Math.floor(cur / EN)] * EN + gens[g].back.e[cur % EN];
      if (parts.length > 64) throw new Error('回溯超深 —— 表坏了');
    }
    return parts.reverse().join(' ');
  };

  return { scrambleFor, coverage, depthHistogram, buildMs: Date.now() - t0 };
}
