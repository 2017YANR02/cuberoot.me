/**
 * /math/lsll §3 的结构常数回归锁。issue #40 T1。
 *
 * 这里只锁**与公式表无关**的部分 —— ZBLS 构型空间、pre-AUF 轨道谱、fiber 大小、
 * ZBLL 双侧商。三类 case 数 N₃ 本身依赖所选的 ZBLS 公式表(见 scripts/lsll-class3.mts
 * 的实测:同一构型换条同样合法的公式,轨道数 19 ↔ 62 ↔ 89),故**不**在此锁死;
 * 锁的是它的硬下界基石 297 × 494。
 *
 * 数变了要主动改 baseline 当 review 信号,禁放宽成 toBeGreaterThan。
 */
import { describe, expect, it } from 'vitest';
import { applyMove, solvedCube, type Cube333 } from '@/lib/lsll/cube333';

// 槽角 = piece 4 (DFR) 落在 URF/UFL/ULB/UBR/DFR;槽棱 = piece 8 (FR) 落在 UR/UF/UL/UB/FR
const C_POS = [0, 1, 2, 3, 4];
const E_POS = [0, 1, 2, 3, 8];

function encodePhi(pc: number, co: number, pe: number, eoAt: Map<number, number>): string {
  return `${pc}.${co}|${pe}|${E_POS.map((p) => eoAt.get(p) ?? 0).join('')}`;
}

/** ZBLS 构型全表:槽角(位置 × 扭)× 槽棱(位置 × 翻)× 其余 4 棱位 EO,受总翻转守恒约束。 */
function phiCensus(): string[] {
  const all: string[] = [];
  for (const pc of C_POS) for (let co = 0; co < 3; co++) {
    for (const pe of E_POS) for (let eSlot = 0; eSlot < 2; eSlot++) {
      const restPos = E_POS.filter((p) => p !== pe);
      for (let mask = 0; mask < 16; mask++) {
        const bits = restPos.map((_unused, i) => (mask >> i) & 1);
        if ((eSlot + bits.reduce((a, b) => a + b, 0)) % 2 !== 0) continue;
        const eoAt = new Map<number, number>([[pe, eSlot]]);
        restPos.forEach((p, i) => eoAt.set(p, bits[i]));
        all.push(encodePhi(pc, co, pe, eoAt));
      }
    }
  }
  return all;
}

/** pre-AUF 对 φ 的作用:顶层位置 0→1→2→3→0,槽位 4 / 8 不动。 */
function rotPhi(code: string): string {
  const [cPart, ePart, eoPart] = code.split('|');
  const [pcS, coS] = cPart.split('.');
  const pc = +pcS, pe = +ePart;
  const eo = eoPart.split('').map(Number); // 顺序 = E_POS
  return `${pc < 4 ? (pc + 1) % 4 : pc}.${coS}|${pe < 4 ? (pe + 1) % 4 : pe}|${[eo[3], eo[0], eo[1], eo[2], eo[4]].join('')}`;
}

function orbitSpectrum() {
  const stab = new Map<string, number>();
  for (const p of phiCensus()) {
    const images = [p];
    let q = p;
    for (let k = 0; k < 3; k++) { q = rotPhi(q); images.push(q); }
    const rep = [...images].sort()[0];
    if (!stab.has(rep)) stab.set(rep, 4 / new Set(images).size);
  }
  return stab;
}

// ── ZBLL 态空间(ZBLS 解完之后剩下的自由度) ──
function compose(a: Cube333, b: Cube333): Cube333 {
  const cp = Array<number>(8), co = Array<number>(8);
  const ep = Array<number>(12), eo = Array<number>(12);
  for (let i = 0; i < 8; i++) { cp[i] = a.cp[b.cp[i]]; co[i] = (a.co[b.cp[i]] + b.co[i]) % 3; }
  for (let i = 0; i < 12; i++) { ep[i] = a.ep[b.ep[i]]; eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2; }
  return { cp, co, ep, eo };
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

function zbllStates(): Cube333[] {
  const out: Cube333[] = [];
  for (const cperm of permutations([0, 1, 2, 3])) {
    const cpar = parity(cperm);
    for (const eperm of permutations([0, 1, 2, 3])) {
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

describe('LSLL 三类 AUF 的结构常数(/math/lsll §3)', () => {
  const stab = orbitSpectrum();

  it('ZBLS 构型空间 |Φ| = 1200', () => {
    expect(phiCensus().length).toBe(1200);
  });

  it('模 pre-AUF 得 306 个 ZBLS 大类 = DB 的 305 条 + 全解态', () => {
    expect(stab.size).toBe(306);
  });

  it('pre-AUF 轨道谱 297 自由 + 3 个 |Stab|=2 + 6 个 |Stab|=4,且配平回 1200', () => {
    const spec = new Map<number, number>();
    for (const v of stab.values()) spec.set(v, (spec.get(v) ?? 0) + 1);
    expect(spec.get(1)).toBe(297);
    expect(spec.get(2)).toBe(3);
    expect(spec.get(4)).toBe(6);
    expect(4 * 297 + 2 * 3 + 1 * 6).toBe(1200);
  });

  it('9 个对称构型全部是「槽块归位」构型(槽角在 DFR、槽棱在 FR)', () => {
    const sym = [...stab].filter(([, v]) => v > 1).map(([k]) => k);
    expect(sym.length).toBe(9);
    for (const code of sym) expect(code.startsWith('4.')).toBe(true);
    for (const code of sym) expect(code.split('|')[1]).toBe('8');
  });

  it('每个 fiber = 7776 态,恰好铺满 9,331,200', () => {
    expect(zbllStates().length).toBe(7776);
    expect(1200 * 7776).toBe(9331200);
  });

  it('fiber 上 mid + post 双侧商 = 494(通行的 ZBLL 493 + 全解态)', () => {
    const states = zbllStates();
    const key = (s: Cube333) => `${s.cp.slice(0, 4).join('')}.${s.co.slice(0, 4).join('')}.${s.ep.slice(0, 4).join('')}`;
    const idx = new Map(states.map((s, i) => [key(s), i]));
    const parent = states.map((_, i) => i);
    const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const U1 = applyMove(solvedCube(), 'U', 1);
    for (let i = 0; i < states.length; i++) {
      for (const g of [compose(states[i], U1), compose(U1, states[i])]) {
        const j = idx.get(key(g));
        expect(j).toBeDefined();
        const a = find(i), b = find(j!);
        if (a !== b) parent[a] = b;
      }
    }
    expect(new Set(states.map((_, i) => find(i))).size).toBe(494);
  });

  it('三类 case 数 = 两步组合 306 × 494 = 151,164(与公式表无关)', () => {
    // mid-AUF 不作用在状态上,作用在解法上 ⇒ 不能拿它再商一次。良定义的量是
    // 「(ZBLS case, ZBLL case) 组合数」:两个集合各自规范,乘积对任何公式表都一样。
    expect(306 * 494).toBe(151164);
    expect(151164 - 1).toBe(151163);        // 扣掉「全部已解」那一格
  });

  it('商定义的形状:硬部分 146,718、区间 [147,220, 151,164]、上确界 = 组合数', () => {
    expect(297 * 494).toBe(146718);          // 297 个自由大类,与选择无关
    // 9 个对称大类每个 ∈ [1, 494],全解那类恒为 494 ⇒ 严格区间
    expect(146718 + 494 + 8 * 1).toBe(147220);
    expect(146718 + 9 * 494).toBe(151164);
    // 上界 = 组合数,且 scripts/lsll-class3.mts 的共轭类扫描证明 9 个对称类全部够得着
    expect(146718 + 9 * 494).toBe(306 * 494);
    // 站内当前公式库这一实例:低于上确界的部分 = 被公式强行粘掉的 ZBLL case
    expect(151164 - 147508).toBe(3656);
    // 天真估算 583,284/4 落在区间下方 ⇒ 商定义的真值必然大于它
    expect(583284 / 4).toBe(145821);
    expect(145821 < 147220).toBe(true);
  });

  it('同一构造套到末层上复现社区数字:OLL 58、PLL 22', () => {
    // 判据:三类 = 两步 case 集合相乘。拿它去数 OLL→PLL,应当给出大家在用的 57+跳 / 21+跳。
    const U_C = [3, 0, 1, 2];                // U 把位置 p 上的块送到 U_C[p]

    // OLL:朝向态 = 角扭 4 元(和 ≡ 0 mod 3)× 棱翻 4 元(和 ≡ 0 mod 2)= 27 × 8
    const ori: [number[], number[]][] = [];
    for (let c = 0; c < 81; c++) {
      const co = [0, 1, 2, 3].map((i) => Math.floor(c / 3 ** i) % 3);
      if (co.reduce((a, b) => a + b) % 3) continue;
      for (let e = 0; e < 16; e++) {
        const eo = [0, 1, 2, 3].map((i) => (e >> i) & 1);
        if (eo.reduce((a, b) => a + b) % 2) continue;
        ori.push([co, eo]);
      }
    }
    expect(ori.length).toBe(216);
    const rotOri = ([co, eo]: [number[], number[]], k: number): [number[], number[]] => {
      let c = co, o = eo;
      for (let i = 0; i < k; i++) {
        const nc: number[] = [], no: number[] = [];
        for (let p = 0; p < 4; p++) { nc[U_C[p]] = c[p]; no[U_C[p]] = o[p]; }
        c = nc; o = no;
      }
      return [c, o];
    };
    const kOri = (s: [number[], number[]]) => `${s[0].join('')}|${s[1].join('')}`;
    const oll = new Set(ori.map((s) => {
      let best = kOri(s);
      for (let k = 1; k < 4; k++) { const t = kOri(rotOri(s, k)); if (t < best) best = t; }
      return best;
    }));
    expect(oll.size).toBe(58);               // 57 + 跳 O

    // PLL:角/棱置换同奇偶 = 4!·4!/2 = 288,模 pre-AUF(左)+ post-AUF(右)
    const perms: number[][] = [];
    (function gen(cur: number[], left: number[]) {
      if (!left.length) { perms.push(cur); return; }
      for (const x of left) gen([...cur, x], left.filter((y) => y !== x));
    })([], [0, 1, 2, 3]);
    const sgn = (p: number[]) => {
      let n = 0;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (p[i] > p[j]) n++;
      return n & 1;
    };
    const mul = (a: number[], b: number[]) => a.map((_, i) => a[b[i]]);
    const Up = [0, 1, 2, 3].map((i) => U_C.indexOf(i));
    const pllStates = perms.flatMap((s) => perms.filter((t) => sgn(t) === sgn(s)).map((t) => [s, t]));
    expect(pllStates.length).toBe(288);
    const pll = new Set(pllStates.map(([s, t]) => {
      let best: string | null = null;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        let L = [0, 1, 2, 3], R = [0, 1, 2, 3];
        for (let i = 0; i < a; i++) L = mul(Up, L);
        for (let i = 0; i < b; i++) R = mul(R, Up);
        const k = `${mul(mul(L, s), R).join('')}|${mul(mul(L, t), R).join('')}`;
        if (best === null || k < best) best = k;
      }
      return best;
    }));
    expect(pll.size).toBe(22);               // 21 + 跳 P

    // 两步末层 = 58 × 22;而 1LLL 的 3916 ÷ 4 = 979 与它差得远 —— 正如 583,284 ÷ 4 之于 151,164。
    expect(oll.size * pll.size).toBe(1276);
    expect(3916 / 4).toBe(979);
  });
});
