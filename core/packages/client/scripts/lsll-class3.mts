/**
 * LSLL 三类 AUF(pre / mid / post)case 数 N₃ 的精确计算。issue #40 T1。
 *
 * 二类(pre+post,583,284)已由 lib/lsll/model.ts 锁死。三类多商一个 mid-AUF ——
 * 「ZBLS 做完、ZBLL 之前」的转顶层。mid 不是状态空间上的规范作用:它要借助
 * ZBLS/ZBLL 的两段拆分才有定义,故本脚本按速拧现实固定「每个 ZBLS case 一条公式
 * Z_φ」(取站内 zbls 公式库的主推解法)。
 *
 * 结构(本脚本逐条实证,不靠信任):
 *   Φ = ZBLS 构型空间,|Φ| = 1200;模 pre-AUF 得 306 个 ZBLS case(DB 305 = 306 − 全解态)。
 *   固定 Z_φ 后 fiber ≅ ZBLL 空间(7776),mid = 右乘 U、post = 左乘 U,双侧商 = 493。
 *   pre-AUF 的 stabilizer 若非平凡,还会在 fiber 上多诱导一个「右乘 V = Z⁻¹UᵏZ」。
 *   ⇒ N₃ = 297·493 + Σ(9 个对称 φ 的轨道数)。
 *
 * 跑:NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-class3.mts
 *    (Node ≥23 的原生 .ts 剥离会抢在 tsx 的 loader 前面,不加这个 flag 会报「没有 applyMove 导出」。)
 */
import { readFileSync } from 'node:fs';
import {
  type Cube333, applyMove, solvedCube,
} from '../lib/lsll/cube333.ts';

// ── 群运算(cube333 只给了「状态 · 移动」,补上一般复合与求逆) ──

/** 先 a 后 b。与 applyMove 同构:新位置 i 的块 = a 在 b 指向的旧位置上的块。 */
function compose(a: Cube333, b: Cube333): Cube333 {
  const cp = Array<number>(8), co = Array<number>(8);
  const ep = Array<number>(12), eo = Array<number>(12);
  for (let i = 0; i < 8; i++) { cp[i] = a.cp[b.cp[i]]; co[i] = (a.co[b.cp[i]] + b.co[i]) % 3; }
  for (let i = 0; i < 12; i++) { ep[i] = a.ep[b.ep[i]]; eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2; }
  return { cp, co, ep, eo };
}

function inverse(s: Cube333): Cube333 {
  const cp = Array<number>(8), co = Array<number>(8);
  const ep = Array<number>(12), eo = Array<number>(12);
  for (let i = 0; i < 8; i++) { cp[s.cp[i]] = i; co[s.cp[i]] = (3 - s.co[i]) % 3; }
  for (let i = 0; i < 12; i++) { ep[s.ep[i]] = i; eo[s.ep[i]] = s.eo[i]; }
  return { cp, co, ep, eo };
}

const U1 = applyMove(solvedCube(), 'U', 1);

// ── LSLL 坐标 ──
// 槽角 = piece 4 (DFR),可落在 URF/UFL/ULB/UBR/DFR = 位置 0,1,2,3,4
// 槽棱 = piece 8 (FR),可落在 UR/UF/UL/UB/FR = 位置 0,1,2,3,8
const SLOT_CORNER = 4, SLOT_EDGE = 8;
const C_POS = [0, 1, 2, 3, 4];
const E_POS = [0, 1, 2, 3, 8];

// ── §1 独立枚举 Φ,验证 1200 / 306 / 轨道谱 ──

/** 直接按定义数 |Φ| 与 U-轨道谱,不构造魔方态(纯组合,零出错面)。 */
function phiCensus() {
  const all: string[] = [];
  for (const pc of C_POS) for (let co = 0; co < 3; co++) {
    for (const pe of E_POS) for (let eSlot = 0; eSlot < 2; eSlot++) {
      const restPos = E_POS.filter((p) => p !== pe);
      for (let mask = 0; mask < 16; mask++) {
        const bits = restPos.map((_unused, i) => (mask >> i) & 1);
        if ((eSlot + bits.reduce((a, b) => a + b, 0)) % 2 !== 0) continue;
        // 规范串:位置 → eo,便于施加 U 置换
        const eoAt = new Map<number, number>([[pe, eSlot]]);
        restPos.forEach((p, i) => eoAt.set(p, bits[i]));
        all.push(encodePhi(pc, co, pe, eoAt));
      }
    }
  }
  return all;
}

function encodePhi(pc: number, co: number, pe: number, eoAt: Map<number, number>): string {
  return `${pc}.${co}|${pe}|${E_POS.map((p) => eoAt.get(p) ?? 0).join('')}`;
}

/** U 对 φ 的作用:顶层位置 0→1→2→3→0(UR→UF→UL→UB),槽位 4 / 8 不动。 */
function rotPhi(code: string): string {
  const [cPart, ePart, eoPart] = code.split('|');
  const [pcS, coS] = cPart.split('.');
  const pc = +pcS, pe = +ePart;
  const npc = pc < 4 ? (pc + 1) % 4 : pc;
  const npe = pe < 4 ? (pe + 1) % 4 : pe;
  const eo = eoPart.split('').map(Number); // 顺序 = E_POS = [0,1,2,3,8]
  const neo = [eo[3], eo[0], eo[1], eo[2], eo[4]];
  return `${npc}.${coS}|${npe}|${neo.join('')}`;
}

const PHI = phiCensus();
console.log(`|Φ| = ${PHI.length}  (期望 1200)`);

const orbits = new Map<string, string[]>();
const stabOf = new Map<string, number>();
for (const p of PHI) {
  const images = [p]; let q = p;
  for (let k = 0; k < 3; k++) { q = rotPhi(q); images.push(q); }
  const rep = [...images].sort()[0];
  if (!orbits.has(rep)) {
    orbits.set(rep, images);
    stabOf.set(rep, 4 / new Set(images).size);
  }
}
const spectrum = new Map<number, number>();
for (const st of stabOf.values()) spectrum.set(st, (spectrum.get(st) ?? 0) + 1);
console.log(`ZBLS case(Φ / pre-AUF) = ${orbits.size}  (期望 306 = DB 305 + 全解态)`);
console.log('stabilizer 谱:', [...spectrum].map(([k, v]) => `|Stab|=${k}: ${v} 类`).join(', '));

const symmetric = [...stabOf].filter(([, st]) => st > 1);
console.log(`对称 φ 共 ${symmetric.length} 个(期望 9)`);
for (const [rep, st] of symmetric) console.log(`   |Stab|=${st}  ${rep}`);

// ── §2 fiber 上的轨道数 ──
// ZBLS-solved 状态空间 t:槽块归位、LSLL 5 棱 EO 全 0,自由度 = LL 4 角排列/朝向 + LL 4 棱排列。
function enumerateZbllStates(): Cube333[] {
  const out: Cube333[] = [];
  const perms4 = permutations([0, 1, 2, 3]);
  for (const cperm of perms4) {
    const cpar = parity(cperm);
    for (const eperm of perms4) {
      if (parity(eperm) !== cpar) continue; // 其余块全解 ⇒ 角棱置换同奇偶
      for (let o = 0; o < 27; o++) {
        const co = [o % 3, Math.floor(o / 3) % 3, Math.floor(o / 9) % 3, 0];
        co[3] = (3 - (co[0] + co[1] + co[2]) % 3) % 3;
        const s = solvedCube();
        for (let i = 0; i < 4; i++) { s.cp[i] = cperm[i]; s.co[i] = co[i]; s.ep[i] = eperm[i]; }
        out.push(s);
      }
    }
  }
  return out;
}

function permutations(a: number[]): number[][] {
  if (a.length <= 1) return [a];
  const out: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    const rest = [...a.slice(0, i), ...a.slice(i + 1)];
    for (const p of permutations(rest)) out.push([a[i], ...p]);
  }
  return out;
}

function parity(p: number[]): number {
  let inv = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inv++;
  return inv & 1;
}

const ZBLL_STATES = enumerateZbllStates();
console.log(`\n|ZBLL 空间| = ${ZBLL_STATES.length}  (期望 7776)`);

const keyOf = (s: Cube333) => `${s.cp.slice(0, 4).join('')}.${s.co.slice(0, 4).join('')}.${s.ep.slice(0, 4).join('')}`;
const INDEX = new Map(ZBLL_STATES.map((s, i) => [keyOf(s), i]));

/** 在 t 空间做 union-find,生成元由调用方给(每个是 t → t 的置换)。 */
function countOrbits(gens: ((t: Cube333) => Cube333)[]): number {
  const parent = ZBLL_STATES.map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (let i = 0; i < ZBLL_STATES.length; i++) {
    for (const g of gens) {
      const j = INDEX.get(keyOf(g(ZBLL_STATES[i])));
      if (j === undefined) throw new Error('生成元把状态踢出了 ZBLL 空间 —— 它不是 ZBLL 群元素');
      union(i, j);
    }
  }
  return new Set(ZBLL_STATES.map((_, i) => find(i))).size;
}

const midGen = (t: Cube333) => compose(t, U1);   // 右乘 U
const postGen = (t: Cube333) => compose(U1, t);  // 左乘 U

const base = countOrbits([midGen, postGen]);
console.log(`ZBLL case(mid+post 双侧商) = ${base}  (期望 494 = 通行的 493 + 全解态)`);

// ── §3 对称 φ 的额外粘合:需要 Z_φ ──
const zbls = JSON.parse(readFileSync(process.env.ZBLS_JSON ?? 'scripts/.cache/zbls.json', 'utf8')) as {
  cases: { name: string; subgroup: string; setup: string; algs: { alg: string }[][] }[];
};

// 公式含 slice / wide / 括号 / 整体旋转,交给 cubing.js 解析,再按实证索引映射回 Cube333。
const { cube3x3x3 } = await import('cubing/puzzles');
const KP = await cube3x3x3.kpuzzle();
// 库里公式带上游记号(FS' / ML' 粘连、↓ 换握标),必须先过站上同一份规整层再喂 cubing.js
const { normalizeAlg } = await import('../lib/alg_normalize.ts');
const CI = [0, 3, 2, 1, 4, 5, 6, 7];   // CUBING_CORNER_INDEX(自逆)
const EI = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10]; // CUBING_EDGE_INDEX(自逆)

function algToCube(alg: string): Cube333 {
  const p = KP.defaultPattern().applyAlg(normalizeAlg('3x3', alg));
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  const cp = Array<number>(8), co = Array<number>(8);
  const ep = Array<number>(12), eo = Array<number>(12);
  for (let i = 0; i < 8; i++) { cp[i] = CI[c.pieces[CI[i]]]; co[i] = c.orientation[CI[i]]; }
  for (let i = 0; i < 12; i++) { ep[i] = EI[e.pieces[EI[i]]]; eo[i] = e.orientation[EI[i]]; }
  return { cp, co, ep, eo };
}

/**
 * DB case → φ 的 pre-AUF 轨道代表。
 *
 * 只认「槽已经摆在 FR」的 case:A− 这类子组的 setup 末尾带 y′,把最后一槽摆到 FL 位展示
 * (正是 issue #40 T4 要归一掉的),那些 case 的槽块不在 LSLL 标准坐标里,直接跳过 ——
 * 反正 9 个对称 φ 全部是「槽块归位」构型,压根不需要旋转来摆位。
 */
const dbByOrbit = new Map<string, { name: string; subgroup: string; alg: string; k: number }>();
const skipped: string[] = [];
const dirty: string[] = [];  // setup 违反 LSLL 前提(破坏了其余三槽 / D 层)
for (const c of zbls.cases) {
  let st: Cube333;
  try { st = algToCube(c.setup); } catch { skipped.push(`${c.subgroup}/${c.name} (setup 解析失败)`); continue; }
  // LSLL 前提:其余三槽 + D 层必须已解。库里有一批 setup 用了 M / f 这类会破坏 D 层的
  // 记号(如 `M' U M U2 R' F R`),它们根本不是合法 LSLL 态 —— 必须拦掉,否则槽块会
  // 假性「归位」,把非对称 case 误判成对称 φ。
  const fixedOk = [5, 6, 7].every((i) => st.cp[i] === i && st.co[i] === 0)
    && [4, 5, 6, 7, 9, 10, 11].every((i) => st.ep[i] === i && st.eo[i] === 0);
  if (!fixedOk) { dirty.push(`${c.subgroup}/${c.name}: "${c.setup}"`); continue; }
  if (!C_POS.includes(st.cp.indexOf(SLOT_CORNER)) || !E_POS.includes(st.ep.indexOf(SLOT_EDGE))) {
    skipped.push(`${c.subgroup}/${c.name} (槽不在 FR)`); continue;
  }
  const norm = { state: st, k: 0 };
  const code = phiFromCube(norm.state);
  const images = [code]; let q = code;
  for (let k = 0; k < 3; k++) { q = rotPhi(q); images.push(q); }
  const rep = [...images].sort()[0];
  if (dbByOrbit.has(rep)) continue;
  // 公式库里有脏条目(`ML'` 这类粘连 token、箭头注记),取第一条真能解析的
  for (const row of c.algs?.[0] ?? []) {
    const alg = row?.alg ?? '';
    if (!alg) continue;
    try { algToCube(alg); } catch { continue; }
    dbByOrbit.set(rep, { name: c.name, subgroup: c.subgroup, alg, k: norm.k });
    break;
  }
}

function phiFromCube(s: Cube333): string {
  const pc = s.cp.indexOf(SLOT_CORNER), pe = s.ep.indexOf(SLOT_EDGE);
  if (!C_POS.includes(pc) || !E_POS.includes(pe)) throw new Error('not LSLL');
  const eoAt = new Map<number, number>(E_POS.map((p) => [p, s.eo[p]]));
  return encodePhi(pc, s.co[pc], pe, eoAt);
}

console.log(`\nDB 匹配上的 ZBLS case: ${dbByOrbit.size} / 305;跳过 ${skipped.length} 条;判为违反 LSLL 前提 ${dirty.length} 条`);
if (dirty.length) console.log('  违反前提(前 5 条):\n    ' + dirty.slice(0, 5).join('\n    '));
if (skipped.length) console.log('  跳过(含整体旋转/非法):', skipped.slice(0, 8).join(', '), skipped.length > 8 ? '…' : '');

let total = 0;
const detail: string[] = [];
for (const [rep, st] of stabOf) {
  if (st === 1) { total += base; continue; }
  const hit = dbByOrbit.get(rep);
  if (!hit) {
    // 全解态没有公式(Z = 恒等),stabilizer 诱导的正是 mid 本身 ⇒ 无额外粘合
    const isSolved = rep === encodePhi(4, 0, 8, new Map(E_POS.map((p) => [p, 0])));
    if (isSolved) { total += base; detail.push(`[全解 φ] Z=id → ${base}`); continue; }
    detail.push(`⚠ 对称 φ 在 DB 找不到公式:${rep}(|Stab|=${st})`);
    total += base;
    continue;
  }
  // setup 归一时转了 y^k,公式要同步共轭:Z' = y⁻ᵏ Z yᵏ
  const Z = algToCube(hit.alg);
  const Zi = inverse(Z);
  const k = 4 / st; // |Stab|=4 → 生成元 U;|Stab|=2 → 生成元 U²
  let Uk = solvedCube();
  for (let i = 0; i < k; i++) Uk = compose(Uk, U1);
  const V = compose(compose(Zi, Uk), Z);
  let n: number;
  try { n = countOrbits([midGen, postGen, (t) => compose(t, V)]); } catch (e) {
    detail.push(`⚠ ${hit.subgroup}/${hit.name}: V 不在 ZBLL 群内(公式没把 φ 解干净?)—— ${(e as Error).message}`);
    total += base; continue;
  }
  total += n;
  detail.push(`${hit.subgroup}/${hit.name}  |Stab|=${st}  Z="${hit.alg}"  → 轨道 ${n}`);
}

console.log('\n对称 φ 逐条:');
for (const d of detail) console.log('  ' + d);
const free = [...stabOf.values()].filter((v) => v === 1).length;
console.log(`\n自由类 ${free} × ${base} = ${free * base}  ← 与公式表选择无关,硬结论`);
console.log(`当前站内公式库下 N₃ = ${total}`);
console.log(`严格区间:N₃ ∈ [${free * base + base + 8}, ${free * base + 9 * base}]`);
console.log(`对照:二类 583,284;issue 的估算 583284/4 = ${583284 / 4} ← 真值必然大于它`);
console.log(`\n※ N₃ 非良定义:mid-AUF 要靠 ZBLS/ZBLL 的两段拆分才有定义,换一条同样合法的`);
console.log(`  ZBLS 公式,对称构型的轨道数就变(实测同一构型 19 ↔ 62 ↔ 89)。只有 9 个有`);
console.log(`  pre-AUF 对称的构型受影响,297 个自由构型的 ${free * base} 是硬的。`);
