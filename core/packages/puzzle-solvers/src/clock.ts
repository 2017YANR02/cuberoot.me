/**
 * 魔表(Rubik's Clock)状态模型 + 整解最优求解器 —— 纯 TS,零下载表,零 worker。
 *
 * ## 状态
 *
 * 18 个表盘(正面 9 + 反面 9,行优先 3×3),每个 0..11(12 点为还原)。其中只有 **14 个自由**:
 * 四个角位的正/反表盘同轴,恒有 `back_corner = −front_corner`,给出 4 条约束。故
 * |G| = 12^14 = 1,283,918,464,548,864,且群是**阿贝尔群**(招式两两可交换)。
 *
 * 下标沿用 tnoodle `ClockPuzzle.java`(见 `app/[lang]/scramble/gen/_svg/clock_svg.ts`):
 *
 *     正面 0 1 2      反面  9 10 11
 *          3 4 5           12 13 14
 *          6 7 8           15 16 17
 *
 * 正面下标 = **当前面朝解算者那一面**(`y2` 只是把两个 9 元块整体对调)。角位配对:
 * `0↔11 (UL) / 2↔9 (UR) / 6↔17 (DL) / 8↔15 (DR)`。
 *
 * ## 招式
 *
 * 一步 = (哪几个针脚被顶起的子集 P ⊆ {UL,UR,DL,DR},非空 → 15 种) × (正面 / 反面) = **30 种**,
 * 幅度 1..11。正面一步把 P 各角的**正面象限**整体 +k,并把 P 各角的**反面角盘** −k;反面对称。
 * 因为可交换,最优解里同一种 move type 至多出现一次。
 *
 * WCA 打乱只用其中 9 种正面 + 5 种反面(共 14 个,恰好等于自由度)—— 那是**唯一分解**、不是最优解。
 * God's number = 12(Kogler 2014),随机态最优步数均值 9.4337(Rokicki),仅 39,248 个态需要 12 步。
 *
 * ## 求解算法(精确最优,非启发式)
 *
 * 把 14 个坐标切成三块:正面自有 5 盘(中心 + 4 棱)、反面自有 5 盘、正面 4 角盘。
 * **正面招式不碰反面自有盘,反面招式不碰正面自有盘**,两侧只通过 4 个角盘耦合:
 *
 *     正面自有 5 盘 ← 只由正面招式决定
 *     反面自有 5 盘 ← 只由反面招式决定
 *     正面 4 角盘   = α(正面招式贡献) − β(反面招式贡献)
 *
 * 于是对每一侧建一张 `Z12^4 → 最小步数` 的表(20,736 项):枚举该侧 15 种 type 的用量。
 * 用量并不需要通用线性求解 —— 5 条自有盘方程把 8 个"单角/邻边"用量压成 4 个自由参数
 * (p,q,r,s = 四个单针脚的幅度),其余 4 个邻边用量与"7 种全覆盖 type 的总和 T"全部被解析确定;
 * 只剩把 T 分配给那 7 种 type 需要枚举。见 `enumerateSide`。
 *
 * 最后 `min_α ( F[α] + B[α − 角目标] )`。两侧按步数上限迭代加深,上限由「另一侧的最小步数」
 * 夹出来(见 `solveClock`),故实际枚举量极小(毫秒级)。**结果是可证最优**,不是近似。
 *
 * 参考:Jaap Scherphuis https://www.jaapsch.net/puzzles/clock.htm(群结构 / 30 种招式 / God 表);
 * OptClock(Michael Gottlieb + Ben Whitmore)是已知的另一个最优求解器,本实现未使用其代码。
 * 招式语义与记号照 tnoodle ClockPuzzle.java(WCA 官方打乱器)。
 */

const M = 12;
const mod12 = (x: number): number => ((x % M) + M) % M;

// ─── 角 / 象限 ───────────────────────────────────────────────────────────────

/** 角位顺序,与位掩码 1/2/4/8 对应。 */
export const CLOCK_CORNER_NAMES = ['UL', 'UR', 'DL', 'DR'] as const;
const UL = 1, UR = 2, DL = 4, DR = 8;
const ALL_PINS = UL | UR | DL | DR;

// 下面四张表是「物理角位 ↔ 表盘下标」的唯一来源:求解器、交互式画板(components/
// InteractiveClock)、测试都从这里取,别在别处重抄一份镜像关系。

/** 角 c 的正面象限(4 个表盘)。 */
export const CLOCK_FRONT_QUAD: readonly (readonly number[])[] = [
  [0, 1, 3, 4], // UL
  [1, 2, 4, 5], // UR
  [3, 4, 6, 7], // DL
  [4, 5, 7, 8], // DR
];
/** 角 c 的反面象限。反面 3×3 左右镜像,所以 UL 角落在反面网格的右上。 */
export const CLOCK_BACK_QUAD: readonly (readonly number[])[] = [
  [10, 11, 13, 14], // UL
  [9, 10, 12, 13],  // UR
  [13, 14, 16, 17], // DL
  [12, 13, 15, 16], // DR
];
/** 角 c 的正面 / 反面角盘下标(两者恒互为相反数)。 */
export const CLOCK_FRONT_CORNER_DIAL: readonly number[] = [0, 2, 6, 8];
export const CLOCK_BACK_CORNER_DIAL: readonly number[] = [11, 9, 17, 15];

const FRONT_QUAD = CLOCK_FRONT_QUAD;
const BACK_QUAD = CLOCK_BACK_QUAD;
const FRONT_CORNER_DIAL = CLOCK_FRONT_CORNER_DIAL;
const BACK_CORNER_DIAL = CLOCK_BACK_CORNER_DIAL;

/** 15 种针脚组合的固定编号(0..14):4 单角 → 4 邻边对 → 7 个"全覆盖"组合。 */
export const CLOCK_TYPE_MASKS: readonly number[] = [
  UL, UR, DL, DR,                              // 0..3  单角
  UL | UR, UL | DL, UR | DR, DL | DR,          // 4..7  邻边对(WCA 的 U / L / R / D)
  UR | DL, UL | UR | DL, UL | DR, UL | UR | DR, // 8..11
  UL | DL | DR, UR | DL | DR, ALL_PINS,         // 12..14
];
const TYPE_COUNT = 15;
/** 8..14 这 7 种在"自有 5 盘"方程里列向量完全相同(全 1),只有角贡献不同。 */
const FULL_START = 8;

/** WCA 记号里有名字的 9 种针脚组合。 */
const WCA_NAME_BY_MASK: Readonly<Record<number, string>> = {
  [UL]: 'UL', [UR]: 'UR', [DL]: 'DL', [DR]: 'DR',
  [UL | UR]: 'U', [UL | DL]: 'L', [UR | DR]: 'R', [DL | DR]: 'D',
  [ALL_PINS]: 'ALL',
};
const MASK_BY_WCA_NAME: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(WCA_NAME_BY_MASK).map(([m, n]) => [n, Number(m)]),
);

/** 翻面(y2)后左右镜像:UL↔UR、DL↔DR。 */
function flipMask(mask: number): number {
  return ((mask & UL) ? UR : 0) | ((mask & UR) ? UL : 0)
    | ((mask & DL) ? DR : 0) | ((mask & DR) ? DL : 0);
}

/** 组合名:9 种走 WCA 名,其余 6 种用 `UL+DR` 这类扩展名(UL,UR,DL,DR 固定顺序)。 */
export function clockPinName(mask: number): string {
  const wca = WCA_NAME_BY_MASK[mask];
  if (wca) return wca;
  const parts: string[] = [];
  if (mask & UL) parts.push('UL');
  if (mask & UR) parts.push('UR');
  if (mask & DL) parts.push('DL');
  if (mask & DR) parts.push('DR');
  return parts.join('+');
}

// ─── 状态 / 招式 ─────────────────────────────────────────────────────────────

export interface ClockState {
  /** 18 个表盘位置(0..11)。0..8 = 当前朝向解算者那一面,9..17 = 另一面。 */
  posit: number[];
  /** 每次 y2 翻转一次;决定渲染时哪一面按"正面"配色。 */
  rightSideUp: boolean;
}

/** side: 0 = 当前朝向自己那面,1 = 背面(即 y2 之后那面)。amount: 1..11。 */
export interface ClockMove {
  side: 0 | 1;
  /** 针脚组合位掩码(物理角位,不随 y2 变)。 */
  mask: number;
  amount: number;
}

export const SOLVED_CLOCK = (): ClockState => ({ posit: new Array<number>(18).fill(0), rightSideUp: true });

/** 一步招式对 18 个表盘的增量。 */
export function clockMoveDelta(side: 0 | 1, mask: number, amount: number): number[] {
  const d = new Array<number>(18).fill(0);
  const k = mod12(amount);
  const own = side === 0 ? FRONT_QUAD : BACK_QUAD;
  const otherCorner = side === 0 ? BACK_CORNER_DIAL : FRONT_CORNER_DIAL;
  const touched = new Set<number>();
  for (let c = 0; c < 4; c++) {
    if (!(mask & (1 << c))) continue;
    for (const dial of own[c]) touched.add(dial);
    d[otherCorner[c]] = mod12(d[otherCorner[c]] - k);
  }
  for (const dial of touched) d[dial] = mod12(d[dial] + k);
  return d;
}

export function applyClockMove(state: ClockState, move: ClockMove): ClockState {
  const d = clockMoveDelta(move.side, move.mask, move.amount);
  return { posit: state.posit.map((v, i) => mod12(v + d[i])), rightSideUp: state.rightSideUp };
}

export function applyClockMoves(state: ClockState, moves: readonly ClockMove[]): ClockState {
  let s = state;
  for (const m of moves) s = applyClockMove(s, m);
  return s;
}

export function isClockSolved(state: ClockState): boolean {
  return state.posit.every((v) => mod12(v) === 0);
}

/**
 * 物理帧的 18 位:下标 0..8 恒为**实体正面**(而非"当前朝向解算者那面")。
 *
 * `posit` 是视角相对的(tnoodle 约定:y2 只把两个 9 元块对调),所以同一个物理构型有两种
 * 等价写法。求解 / 记号一律用视角帧(招式名本来就是相对手里那面说的);只有「从还原态生成
 * 一条打乱」要落到物理帧 —— 打乱的起手姿势是固定的。
 */
export function physicalPosit(state: ClockState): number[] {
  return state.rightSideUp
    ? state.posit.map(mod12)
    : [...state.posit.slice(9), ...state.posit.slice(0, 9)].map(mod12);
}

/**
 * 合法性:四个角位的正/反表盘必须互为相反数(同轴联动)。用户手画的状态要过这一关。
 * 返回 null = 合法,否则给出违规的角位名。
 */
export function invalidClockCorner(posit: readonly number[]): string | null {
  for (let c = 0; c < 4; c++) {
    if (mod12(posit[FRONT_CORNER_DIAL[c]] + posit[BACK_CORNER_DIAL[c]]) !== 0) {
      return CLOCK_CORNER_NAMES[c];
    }
  }
  return null;
}

// ─── 记号 ────────────────────────────────────────────────────────────────────

/** 幅度 → WCA 后缀:1..6 用 `n+`,7..11 折成 `(12−n)-`。 */
function amountSuffix(amount: number): string {
  const a = mod12(amount);
  return a <= 6 ? `${a}+` : `${12 - a}-`;
}

/** 招式列表 → 字符串:正面招式 + `y2` + 背面招式(背面按翻面后的镜像名书写)。 */
export function clockMovesToString(moves: readonly ClockMove[]): string {
  const front = moves.filter((m) => m.side === 0);
  const back = moves.filter((m) => m.side === 1);
  const tok = (m: ClockMove) =>
    `${clockPinName(m.side === 0 ? m.mask : flipMask(m.mask))}${amountSuffix(m.amount)}`;
  const parts = front.map(tok);
  if (back.length > 0) {
    parts.push('y2');
    parts.push(...back.map(tok));
  }
  return parts.join(' ');
}

const TOKEN_RE = /^([A-Z+]+)(\d+)([+-])$/;

/** 解析一条魔表算法(WCA 记号 + 本文件的扩展针脚名)。坏 token 抛错。 */
export function parseClockMoves(alg: string): ClockMove[] {
  const out: ClockMove[] = [];
  let side: 0 | 1 = 0;
  for (const raw of alg.trim().split(/\s+/).filter(Boolean)) {
    if (raw === 'y2') { side = side === 0 ? 1 : 0; continue; }
    if (/^[UDud]{4}$/.test(raw)) continue; // tnoodle 末尾的针脚状态描述,与状态无关
    const m = TOKEN_RE.exec(raw);
    if (!m) throw new Error(`bad clock token: ${raw}`);
    const named = m[1];
    let mask = MASK_BY_WCA_NAME[named];
    if (mask === undefined) {
      mask = 0;
      for (const part of named.split('+')) {
        const bit = CLOCK_CORNER_NAMES.indexOf(part as (typeof CLOCK_CORNER_NAMES)[number]);
        if (bit < 0) throw new Error(`bad clock token: ${raw}`);
        mask |= 1 << bit;
      }
    }
    if (mask === 0) throw new Error(`bad clock token: ${raw}`);
    const amount = mod12(parseInt(m[2], 10) * (m[3] === '+' ? 1 : -1));
    // 书写的是"当前朝向自己那面"的名字 → side=1 时要镜像回物理角位。
    out.push({ side, mask: side === 0 ? mask : flipMask(mask), amount });
  }
  return out;
}

/** 从还原态施加一条算法,得到状态(含 y2 造成的 rightSideUp 翻转)。 */
export function clockStateFromAlg(alg: string): ClockState {
  const state = SOLVED_CLOCK();
  let rightSideUp = true;
  for (const raw of alg.trim().split(/\s+/).filter(Boolean)) if (raw === 'y2') rightSideUp = !rightSideUp;
  const out = applyClockMoves(state, parseClockMoves(alg));
  // posit 一律以"当前朝向自己那面"为 0..8;若算法末尾停在翻面状态,把两块对调过来。
  if (!rightSideUp) {
    const p = out.posit;
    out.posit = [...p.slice(9), ...p.slice(0, 9)];
    out.rightSideUp = false;
  }
  return out;
}

// ─── 14 维坐标切分 ───────────────────────────────────────────────────────────

/** 自有 5 盘的规范顺序:中心,然后 4 条"邻边对"棱盘。 */
const FRONT_OWN = [4, 1, 3, 5, 7];   // 中心 / {UL,UR} / {UL,DL} / {UR,DR} / {DL,DR}
const BACK_OWN = [13, 10, 14, 12, 16];
// 两张表的下标 1..4 对应同一组"邻边对"针脚掩码 {UL,UR} / {UL,DL} / {UR,DR} / {DL,DR}
// (正面是 1/3/5/7 号盘,反面因左右镜像成了 10/14/12/16 号盘)—— 故两侧共用一份枚举器。

const CORNER_IDX = (a0: number, a1: number, a2: number, a3: number) =>
  ((a0 * M + a1) * M + a2) * M + a3;
const CORNER_SPACE = M * M * M * M; // 20736

/** 每种 type 对 4 个角的贡献指示(1 = 该 type 会把这个角盘 +amount)。 */
const TYPE_CORNER_BITS: readonly number[] = CLOCK_TYPE_MASKS;

// ─── 单侧枚举 ────────────────────────────────────────────────────────────────

interface SideTable {
  /** cost[cornerIdx] = 达成该角贡献向量所需的最少步数(255 = 未覆盖)。 */
  cost: Uint8Array;
  /** combo[cornerIdx] = 15 种 type 各自的幅度(0 = 不用)。 */
  combo: (Uint8Array | null)[];
  /** 该侧最小步数(只满足自有 5 盘、角向量任意)。 */
  min: number;
}

/**
 * 枚举一侧所有 ≤ cap 步、且恰好命中 `own5` 的用量组合,填出 `角贡献向量 → 最小步数`。
 *
 * `own5` = [中心, 4 条邻边棱盘] 的目标增量。5 条方程给出:
 *   Z_i := 中心 − 棱_i = "与该邻边对不相交的那 3 种 type 的幅度之和"
 * 由此 4 个邻边对用量被 (p,q,r,s) 解析确定,中心方程再定出 7 种全覆盖 type 的总和 T。
 */
function enumerateSide(own5: readonly number[], cap: number): SideTable {
  const cost = new Uint8Array(CORNER_SPACE).fill(255);
  const combo: (Uint8Array | null)[] = new Array(CORNER_SPACE).fill(null);
  const [center, e0, e1, e2, e3] = own5;
  // Z0 对应 pair0={UL,UR} → 排除的是 P ⊆ {DL,DR} 的三种(DL / DR / {DL,DR})
  const Z0 = mod12(center - e0); // r + s + d
  const Z1 = mod12(center - e1); // q + s + rho
  const Z2 = mod12(center - e2); // p + r + l
  const Z3 = mod12(center - e3); // p + q + u
  const scratch = new Uint8Array(TYPE_COUNT);
  let min = 255;

  const record = (a0: number, a1: number, a2: number, a3: number, c: number) => {
    const idx = CORNER_IDX(a0, a1, a2, a3);
    if (c >= cost[idx]) return;
    cost[idx] = c;
    combo[idx] = scratch.slice();
    if (c < min) min = c;
  };

  // 把 T 分配给 8..14 这 7 种全覆盖 type,最多 budget 个非零。
  const distribute = (
    i: number, budget: number, remT: number,
    a0: number, a1: number, a2: number, a3: number, used: number,
  ) => {
    if (i === TYPE_COUNT) {
      if (remT === 0) record(a0, a1, a2, a3, used);
      return;
    }
    // 该 type 不用
    scratch[i] = 0;
    distribute(i + 1, budget, remT, a0, a1, a2, a3, used);
    if (budget === 0) return;
    const bits = TYPE_CORNER_BITS[i];
    const b0 = bits & UL ? 1 : 0, b1 = bits & UR ? 1 : 0, b2 = bits & DL ? 1 : 0, b3 = bits & DR ? 1 : 0;
    // 只剩最后一种可用 → 幅度被 remT 钉死
    const lastUsable = budget === 1 || i === TYPE_COUNT - 1;
    if (lastUsable) {
      if (remT === 0) return;
      scratch[i] = remT;
      distribute(i + 1, budget - 1, 0,
        mod12(a0 + b0 * remT), mod12(a1 + b1 * remT), mod12(a2 + b2 * remT), mod12(a3 + b3 * remT),
        used + 1);
      scratch[i] = 0;
      return;
    }
    for (let t = 1; t < M; t++) {
      scratch[i] = t;
      distribute(i + 1, budget - 1, mod12(remT - t),
        mod12(a0 + b0 * t), mod12(a1 + b1 * t), mod12(a2 + b2 * t), mod12(a3 + b3 * t),
        used + 1);
    }
    scratch[i] = 0;
  };

  for (let p = 0; p < M; p++) {
    for (let q = 0; q < M; q++) {
      const u = mod12(Z3 - p - q);
      for (let r = 0; r < M; r++) {
        const l = mod12(Z2 - p - r);
        for (let s = 0; s < M; s++) {
          const rho = mod12(Z1 - q - s);
          const d = mod12(Z0 - r - s);
          let c0 = 0;
          if (p) c0++; if (q) c0++; if (r) c0++; if (s) c0++;
          if (u) c0++; if (l) c0++; if (rho) c0++; if (d) c0++;
          if (c0 > cap) continue;
          const T = mod12(center - (p + q + r + s + u + l + rho + d));
          scratch[0] = p; scratch[1] = q; scratch[2] = r; scratch[3] = s;
          scratch[4] = u; scratch[5] = l; scratch[6] = rho; scratch[7] = d;
          // 角贡献:α_UL = p + u + l + …, α_UR = q + u + rho + …,依此类推
          distribute(FULL_START, cap - c0, T,
            mod12(p + u + l), mod12(q + u + rho), mod12(r + l + d), mod12(s + rho + d), c0);
        }
      }
    }
  }
  return { cost, combo, min };
}

// ─── 最优求解 ────────────────────────────────────────────────────────────────

export interface ClockSolution {
  moves: ClockMove[];
  /** 步数 = moves.length,已证最优。 */
  length: number;
  notation: string;
}

/** 状态 → 需要施加的总增量(把每个盘拨回 12 点)。 */
function solveTarget(state: ClockState): number[] {
  return state.posit.map((v) => mod12(-v));
}

/**
 * 求最优解(最少步数,一步 = 一次针脚组合 + 一次转动)。可证最优:两侧按步数迭代加深,
 * 直到「任何漏掉的解都不可能更短」为止。
 */
export function solveClock(state: ClockState): ClockSolution {
  const bad = invalidClockCorner(state.posit);
  if (bad) throw new Error(`illegal clock state: corner ${bad} front/back mismatch`);
  const t = solveTarget(state);

  const own5F = FRONT_OWN.map((i) => t[i]);
  const own5B = BACK_OWN.map((i) => t[i]);
  const cornerTarget = FRONT_CORNER_DIAL.map((i) => t[i]); // = α − β

  // 先各自求最小步数(只管自有 5 盘),用来夹另一侧的枚举上限。
  let capF = 0, capB = 0;
  let tabF = enumerateSide(own5F, capF);
  while (tabF.min === 255) { capF++; tabF = enumerateSide(own5F, capF); }
  let tabB = enumerateSide(own5B, capB);
  while (tabB.min === 255) { capB++; tabB = enumerateSide(own5B, capB); }
  const minF = tabF.min, minB = tabB.min;

  let best = 255;
  let bestAlpha = -1;
  const combine = () => {
    for (let a0 = 0; a0 < M; a0++) {
      for (let a1 = 0; a1 < M; a1++) {
        for (let a2 = 0; a2 < M; a2++) {
          for (let a3 = 0; a3 < M; a3++) {
            const ai = CORNER_IDX(a0, a1, a2, a3);
            const cf = tabF.cost[ai];
            if (cf === 255 || cf >= best) continue;
            const bi = CORNER_IDX(
              mod12(a0 - cornerTarget[0]), mod12(a1 - cornerTarget[1]),
              mod12(a2 - cornerTarget[2]), mod12(a3 - cornerTarget[3]),
            );
            const cb = tabB.cost[bi];
            if (cb === 255) continue;
            if (cf + cb < best) { best = cf + cb; bestAlpha = ai; }
          }
        }
      }
    }
  };
  combine();

  // 收敛判据:漏掉的解必然某一侧 > cap,故总步数 ≥ cap+1+另一侧最小步数。
  for (;;) {
    const provenF = best <= capF + 1 + minB;
    const provenB = best <= capB + 1 + minF;
    if (provenF && provenB) break;
    if (!provenF) { capF++; tabF = enumerateSide(own5F, capF); }
    if (!provenB) { capB++; tabB = enumerateSide(own5B, capB); }
    combine();
  }

  const moves: ClockMove[] = [];
  if (bestAlpha >= 0) {
    const bi = (() => {
      const a0 = Math.floor(bestAlpha / (M * M * M)) % M;
      const a1 = Math.floor(bestAlpha / (M * M)) % M;
      const a2 = Math.floor(bestAlpha / M) % M;
      const a3 = bestAlpha % M;
      return CORNER_IDX(
        mod12(a0 - cornerTarget[0]), mod12(a1 - cornerTarget[1]),
        mod12(a2 - cornerTarget[2]), mod12(a3 - cornerTarget[3]),
      );
    })();
    const cf = tabF.combo[bestAlpha];
    const cb = tabB.combo[bi];
    for (let i = 0; i < TYPE_COUNT; i++) {
      if (cf && cf[i]) moves.push({ side: 0, mask: CLOCK_TYPE_MASKS[i], amount: cf[i] });
    }
    for (let i = 0; i < TYPE_COUNT; i++) {
      if (cb && cb[i]) moves.push({ side: 1, mask: CLOCK_TYPE_MASKS[i], amount: cb[i] });
    }
  }
  return { moves, length: moves.length, notation: clockMovesToString(moves) };
}

// ─── WCA 规范 14 步分解 ──────────────────────────────────────────────────────

/** WCA 打乱用到的 14 个 type:正面 9 个 + 背面 5 个(记的是**物理**角掩码)。 */
const CANON_FRONT_MASKS = [UR, DR, DL, UL, UL | UR, UR | DR, DL | DR, UL | DL, ALL_PINS];
const CANON_BACK_WCA = ['U', 'R', 'D', 'L', 'ALL'] as const;
const CANON_BACK_MASKS = CANON_BACK_WCA.map((n) => flipMask(MASK_BY_WCA_NAME[n]));

/** 14 维坐标顺序:正面 9 盘 + 反面 5 个自有盘。 */
const CANON_COORDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, ...BACK_OWN];

let canonInverse: number[][] | null = null;

/** mod 12 的单位元(gcd=1):1,5,7,11 —— 各自是自己的逆。 */
const UNIT_INVERSE: Readonly<Record<number, number>> = { 1: 1, 5: 5, 7: 7, 11: 11 };

/** 求 14×14 矩阵在 Z12 上的逆(高斯-约当,只用单位元当主元)。 */
function invertMod12(mat: number[][]): number[][] {
  const n = mat.length;
  const a = mat.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = -1;
    for (let row = col; row < n; row++) if (UNIT_INVERSE[a[row][col]] !== undefined) { pivot = row; break; }
    if (pivot < 0) throw new Error(`clock canonical matrix not invertible at column ${col}`);
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const inv = UNIT_INVERSE[a[col][col]];
    for (let j = 0; j < 2 * n; j++) a[col][j] = mod12(a[col][j] * inv);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = a[row][col];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) a[row][j] = mod12(a[row][j] - f * a[col][j]);
    }
  }
  return a.map((row) => row.slice(n));
}

function canonicalInverse(): number[][] {
  if (canonInverse) return canonInverse;
  const cols: number[][] = [];
  for (const mask of CANON_FRONT_MASKS) {
    const d = clockMoveDelta(0, mask, 1);
    cols.push(CANON_COORDS.map((i) => d[i]));
  }
  for (const mask of CANON_BACK_MASKS) {
    const d = clockMoveDelta(1, mask, 1);
    cols.push(CANON_COORDS.map((i) => d[i]));
  }
  // cols[j][i] = 第 j 个生成元对第 i 个坐标的贡献 → 矩阵按行装配
  const mat = CANON_COORDS.map((_, i) => cols.map((c) => c[i]));
  canonInverse = invertMod12(mat);
  return canonInverse;
}

/**
 * WCA 规范分解:把状态写成「正面 9 个 + y2 + 背面 5 个」那唯一一组幅度。
 * 这正是 tnoodle / cubing.js 打乱串的形式 —— 恒 ≤ 14 步,但通常不是最优。
 *
 * @param invert true(默认)= 给出**解开**该状态的一组招式;false = 给出**到达**该状态的打乱。
 */
export function canonicalClockMoves(state: ClockState, invert = true): ClockMove[] {
  const bad = invalidClockCorner(state.posit);
  if (bad) throw new Error(`illegal clock state: corner ${bad} front/back mismatch`);
  const target = invert ? solveTarget(state) : state.posit.map(mod12);
  const rhs = CANON_COORDS.map((i) => target[i]);
  const inv = canonicalInverse();
  const amounts = inv.map((row) => mod12(row.reduce((acc, v, j) => acc + v * rhs[j], 0)));
  const moves: ClockMove[] = [];
  CANON_FRONT_MASKS.forEach((mask, j) => {
    if (amounts[j]) moves.push({ side: 0, mask, amount: amounts[j] });
  });
  CANON_BACK_MASKS.forEach((mask, j) => {
    const a = amounts[CANON_FRONT_MASKS.length + j];
    if (a) moves.push({ side: 1, mask, amount: a });
  });
  return moves;
}

/**
 * 反推打乱:给出一条到达该状态的 WCA 规范打乱(所有 14 个 token 都写出来,含 0 幅度的),
 * 与 tnoodle / cubing.js 的打乱格式逐 token 同形。
 *
 * 打乱从固定起手姿势(正面朝己)开始,所以这里走**物理帧**(见 `physicalPosit`)。串末尾带
 * 一个 `y2`,故按 tnoodle 语义求值后 `rightSideUp` 为 false、两个 9 元块对调 —— 与真实 WCA
 * 打乱同款,表示的是同一个物理构型。
 */
export function clockScrambleForState(state: ClockState): string {
  const moves = canonicalClockMoves({ posit: physicalPosit(state), rightSideUp: true }, false);
  const byMask = new Map<string, number>();
  for (const m of moves) byMask.set(`${m.side}:${m.mask}`, m.amount);
  const parts: string[] = [];
  CANON_FRONT_MASKS.forEach((mask) => {
    parts.push(`${clockPinName(mask)}${amountSuffix(byMask.get(`0:${mask}`) ?? 0)}`);
  });
  parts.push('y2');
  CANON_BACK_MASKS.forEach((mask, j) => {
    parts.push(`${CANON_BACK_WCA[j]}${amountSuffix(byMask.get(`1:${mask}`) ?? 0)}`);
  });
  return parts.join(' ');
}

// ─── 算法层算子(/sim 播放条 + 求解页共用) ──────────────────────────────────

/**
 * 一条算法的逆。魔表群是阿贝尔群 —— 招式两两可交换,所以逆 = 每步幅度取反,**顺序无关**
 * (不必像非交换群那样再倒序)。
 */
export function invertClockMoves(moves: readonly ClockMove[]): ClockMove[] {
  return moves.map((m) => ({ ...m, amount: mod12(-m.amount) }));
}

/**
 * 补齐末尾姿势:让 `text` 里 y2 的**奇偶**等于 `endsFlipped`,差一个就补一个。
 *
 * `clockMovesToString` 的规范形是「正面招式 y2 背面招式」——**有背面招式就自带一个 y2**,
 * 于是收在翻面态。原算法翻了偶数次(如 `... y2 ... y2 ...`)时两者就差一个 y2,末态的两个
 * 9 元块会整块对调。凡是"重新序列化一段魔表算法"的地方都要过这一道。
 */
export function withClockFlipParity(text: string, endsFlipped: boolean): string {
  const writtenFlipped = (text.match(/(?:^| )y2(?: |$)/g) ?? []).length % 2 === 1;
  if (writtenFlipped === endsFlipped) return text;
  return text ? `${text} y2` : 'y2';
}

/** 一段算法里 y2 的奇偶(= 末了是否翻着面)。 */
export function clockAlgEndsFlipped(alg: string): boolean {
  return alg.trim().split(/\s+/).filter((t) => t === 'y2').length % 2 === 1;
}

/**
 * 消步:把针脚组合相同的招式合并成一步(幅度相加 mod 12),幅度归零的整步丢掉。
 *
 * 同样吃阿贝尔性:**不限于相邻**的同组合招式也能合并,因为任意两步都可交换、随便挪到一起。
 * (其它魔方的消步只敢折相邻两步,那是非交换群的限制。)合并只在用户已经用到的针脚组合里
 * 做,不改记号词汇 —— 想要真最短请用求解器(`solveClock`),想要 WCA 规范 14 步用
 * `canonicalClockMoves`。末尾姿势保持不变(见 `withClockFlipParity`)。
 */
export function reduceClockAlg(alg: string): string {
  const sum = new Map<string, { side: 0 | 1; mask: number; amount: number }>();
  const order: string[] = [];
  for (const m of parseClockMoves(alg)) {
    const key = `${m.side}:${m.mask}`;
    const prev = sum.get(key);
    if (prev) prev.amount = mod12(prev.amount + m.amount);
    else { sum.set(key, { side: m.side, mask: m.mask, amount: mod12(m.amount) }); order.push(key); }
  }
  const out: ClockMove[] = [];
  for (const key of order) {
    const m = sum.get(key);
    if (m && m.amount !== 0) out.push(m);
  }
  return withClockFlipParity(clockMovesToString(out), clockAlgEndsFlipped(alg));
}

/** 一条随机 WCA 打乱(均匀随机状态反推,与官方打乱同分布同格式)。 */
export function randomClockScramble(rand: () => number = Math.random): string {
  return clockScrambleForState(randomClockState(rand));
}

// ─── 全空间距离分布 ─────────────────────────────────────────────────────────

/** 状态总数 = 12^14(精确,double 可无损表示:1.28e15 < 2^53)。 */
export const CLOCK_STATE_COUNT = 1_283_918_464_548_864;

/** God's number = 12(Kogler 2014 首证,Rokicki 陪集法独立复核)。 */
export const CLOCK_GODS_NUMBER = 12;

/**
 * `CLOCK_LENGTH_DISTRIBUTION[d]` = 最优步数**恰为** d 的状态数,d = 0..12,逐档精确。
 *
 * 这是**别人算出来的**:全空间 12^14 的 God's algorithm 由 Tomas Rokicki 用陪集分解跑穿
 * (12^5 = 248,832 个陪集压到 9,906 个代表元,约 3 天),表格取自 Jaap Scherphuis 的页面
 * <https://www.jaapsch.net/puzzles/clock.htm>。本机重算不可能,所以本仓库做的是**核验**,
 * 三层证据在 `packages/client/scripts/clock/verify_distribution.mts`(用本仓库自己的转动模型,不引用求解器):
 *
 *   1) 逐档求和 === 12^14 —— 抓誊抄错(实测抓到过 d=4 / d=11 各错一位)
 *   2) d ≤ 4 各档由 30 种 move type 全组合枚举 + 去重**精确重算**,逐档 `===` 对账
 *   3) 均匀随机态抽样直方图对理论占比(卡方 + 逐档 σ),并核对均值 9.4337 与上限 12
 *
 * d = 12 那一档另有硬对账:Rokicki 公布了全部 39,248 个 12 步状态(`solver/reference/clock/
 * dist12.txt`),本站求解器把它们逐个解出恰为 12 步 —— 全 39,248 条已跑通(`packages/client/tests/clock_solver.test.ts`,
 * `CLOCK_DIST12_FULL=1`)。
 *
 * 因为 WCA 打乱是**均匀随机态**,这张表同时就是比赛打乱难度的真实分布(不需要真题语料)。
 */
export const CLOCK_LENGTH_DISTRIBUTION: readonly number[] = [
  1,
  330,
  51_651,
  4_947_912,
  317_141_342,
  14_054_473_232,
  428_862_722_294,
  8_621_633_953_202,
  101_600_180_118_726,
  528_107_928_328_516,
  613_251_601_892_918,
  31_893_880_879_492,
  39_248,
];

/** 均匀随机态的最优步数均值(由上表精确算得;Jaap 页面写 9.4337)。 */
export const CLOCK_MEAN_LENGTH =
  CLOCK_LENGTH_DISTRIBUTION.reduce((a, c, d) => a + c * d, 0) / CLOCK_STATE_COUNT;

/** 随机状态(均匀分布在 12^14 上),= WCA 打乱的分布。 */
export function randomClockState(rand: () => number = Math.random): ClockState {
  const posit = new Array<number>(18).fill(0);
  for (let i = 0; i < 9; i++) posit[i] = Math.floor(rand() * M);
  for (const [c, dial] of BACK_CORNER_DIAL.entries()) posit[dial] = mod12(-posit[FRONT_CORNER_DIAL[c]]);
  for (const i of BACK_OWN) posit[i] = Math.floor(rand() * M);
  return { posit, rightSideUp: true };
}
