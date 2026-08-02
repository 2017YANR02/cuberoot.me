/**
 * cube-photo —— 「拍照识别魔方」的纯逻辑层(不碰 DOM,可测)。
 *
 * 拍 6 张照 → 每张按 n×n 网格取样出每格的代表色 → 把 6·n² 个颜色分成 6 组、每组恰好 n² 格
 * → 拼成 URFDLB facelet,交给已有的画板 / 求解器。
 *
 * 判据不靠「这个 RGB 像不像红色」的绝对阈值(照片的白平衡、曝光、色温全在变),而是:
 *   1. **六色各恰好 n² 格**是魔方的硬约束 —— 用带容量的指派(匈牙利算法)强制满足,于是
 *      红/橙这种最容易混的一对只需要比「谁更橙」,不需要绝对判定;
 *   2. **三阶的六个中心块就是该面颜色的定义** —— 直接锁死当参照色,连色卡都不用;二阶没有
 *      中心块,改成先无标签聚类、再把 6 个簇**整体**匹配到标准配色(相对匹配,整体偏色不影响);
 *   3. **参照色迭代** —— 每轮指派完拿各组质心当新参照,自洽收敛;六张照片光照不同也能拉回来。
 *
 * 距离用 CIE Lab,并把 L 的权重压到 0.4:六色两两之间都不是只差明暗(白/黄差 b*,红/橙差
 * a*:b* 的比例),压低 L 等于免疫曝光差。
 */

export type RGB = readonly [number, number, number];
export type Lab = readonly [number, number, number];
export type PhotoFace = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

/** facelet 面序(与 lib/cube-facelet、lib/pocket-facelet 一致)。 */
export const PHOTO_FACES: readonly PhotoFace[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/** 上一步到这一步要做的整体翻转(文案在组件里,逻辑层只给枚举)。 */
export type ScanMotion = 'start' | 'roll' | 'turnLeft' | 'turnLeft2';

export interface ScanStep {
  /** 这一张拍的是哪个面。 */
  face: PhotoFace;
  /** 画面上方 / 左侧是哪个面(三阶据此生成「白色朝上」这类提示)。 */
  top: PhotoFace;
  left: PhotoFace;
  /** 拍到的 n×n 网格顺时针转几个 90° 才是该面的标准朝向。 */
  rot: 0 | 1 | 2 | 3;
  motion: ScanMotion;
}

/**
 * 拍摄顺序 —— 只有两种动作:向后翻(把顶面推离镜头)和绕竖轴向左转。
 *
 * 记 (FRONT, UP, LEFT) 为**画面**的前/上/左各是哪个面。roll: FRONT←DOWN, UP←FRONT(左右不动);
 * turnLeft: FRONT←RIGHT, LEFT←FRONT(上下不动)。从 (U,B,L) 出发依次得
 *   (U,B,L) →roll (F,U,L) →roll (D,F,L) →roll (B,D,L) →turnLeft (R,D,B) →turnLeft² (L,D,F)
 * 而标准朝向(Kociemba 展开图:U 上方是 B、R 左边是 F、D 上方是 F……)分别是
 *   U(B,L) R(U,F) F(U,L) D(F,L) L(U,B) B(U,R)
 * 前三张正好一致(rot 0),后三张的上/左各自换成了对面 = 整整 180°(rot 2)。
 */
export const SCAN_STEPS: readonly ScanStep[] = [
  { face: 'U', top: 'B', left: 'L', rot: 0, motion: 'start' },
  { face: 'F', top: 'U', left: 'L', rot: 0, motion: 'roll' },
  { face: 'D', top: 'F', left: 'L', rot: 0, motion: 'roll' },
  { face: 'B', top: 'D', left: 'L', rot: 2, motion: 'roll' },
  { face: 'R', top: 'D', left: 'B', rot: 2, motion: 'turnLeft' },
  { face: 'L', top: 'D', left: 'F', rot: 2, motion: 'turnLeft2' },
] as const;

/** 标准(西方)配色的典型**照片**色,只用来给二阶的 6 个簇起名 —— 匹配是相对的,不是阈值。 */
export const CANONICAL_RGB: Readonly<Record<PhotoFace, RGB>> = {
  U: [238, 238, 238],
  R: [190, 30, 40],
  F: [25, 155, 75],
  D: [245, 215, 50],
  L: [245, 125, 25],
  B: [25, 80, 185],
};

/** L 在色差里的权重(< 1 = 压低明暗、看重色相)。 */
const L_WEIGHT = 0.4;
/** 余量低于此值的格子提示人工复核(Lab 单位,经验值)。 */
const UNCERTAIN_MARGIN = 12;
/** 锁死中心块用的天价代价。 */
const LOCK_COST = 1e7;

// ── 颜色空间 ─────────────────────────────────────────────────────────────────────────────────

/** sRGB(0-255)→ 线性 RGB(0-1)。光照校正必须在线性空间做,伽马下的乘法不是乘法。 */
export function srgbToLinear(rgb: RGB): number[] {
  return rgb.map((c) => {
    const v = Math.min(255, Math.max(0, c)) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
}

/** 线性 RGB(0-1)→ CIE Lab(D65)。 */
export function linearToLab(rgb: readonly number[]): Lab {
  const [r, g, b] = rgb;
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(Math.max(0, t)) : (841 / 108) * t + 4 / 29);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** sRGB(0-255)→ CIE Lab(D65)。 */
export function srgbToLab(rgb: RGB): Lab {
  return linearToLab(srgbToLinear(rgb));
}

/** 加权 Lab 色差(L 权重 0.4),返回平方距离 —— 只用来比大小,省一个 sqrt。 */
function labDist2(a: Lab, b: Lab): number {
  const dl = (a[0] - b[0]) * L_WEIGHT;
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

// ── 取样 ─────────────────────────────────────────────────────────────────────────────────────

/**
 * 从一张**正方形** RGBA 位图里取 n×n 个格子的代表色(行主序)。
 *
 * 每格只取中间 `patch` 比例的一小块,并对每个通道取**中位数** —— 高光、贴纸圆角、块与块之间
 * 的黑边都是少数极端值,中位数直接免疫,比平均值稳得多。
 */
export function sampleGridColors(
  data: Uint8ClampedArray | Uint8Array, size: number, n: number, patch = 0.5,
): RGB[] {
  const cell = size / n;
  const half = (cell * patch) / 2;
  const step = Math.max(1, Math.floor((half * 2) / 12)); // 每格最多取 ~12×12 个像素
  const out: RGB[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cx = (c + 0.5) * cell;
      const cy = (r + 0.5) * cell;
      const rs: number[] = [], gs: number[] = [], bs: number[] = [];
      for (let y = Math.round(cy - half); y <= cy + half; y += step) {
        if (y < 0 || y >= size) continue;
        for (let x = Math.round(cx - half); x <= cx + half; x += step) {
          if (x < 0 || x >= size) continue;
          const p = (y * size + x) * 4;
          rs.push(data[p]); gs.push(data[p + 1]); bs.push(data[p + 2]);
        }
      }
      out.push(rs.length ? [median(rs), median(gs), median(bs)] : [0, 0, 0]);
    }
  }
  return out;
}

function median(xs: number[]): number {
  xs.sort((a, b) => a - b);
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

/** n×n 网格顺时针转 k 个 90°(行主序进、行主序出)。 */
export function rotateGrid<T>(grid: readonly T[], n: number, k: number): T[] {
  let cur = grid.slice();
  for (let i = 0; i < (((k % 4) + 4) % 4); i++) {
    const next = new Array<T>(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) next[r * n + c] = cur[(n - 1 - c) * n + r];
    }
    cur = next;
  }
  return cur;
}

// ── 带容量的指派(匈牙利算法)────────────────────────────────────────────────────────────────

/**
 * 方阵最小代价完美指派(e-maxx 的 O(n³) 匈牙利,带势能)。返回 row → col。
 */
export function hungarian(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1);
  const way = new Int32Array(n + 1);
  const minv = new Float64Array(n + 1);
  const used = new Uint8Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    minv.fill(Infinity);
    used.fill(0);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const res = new Array<number>(n);
  for (let j = 1; j <= n; j++) res[p[j] - 1] = j - 1;
  return res;
}

/**
 * 把 m 个样本分给 6 个标签、**每个标签恰好 cap 个**(m = 6·cap)。
 * `lock[i] >= 0` 时把样本 i 钉死在该标签上(三阶中心块)。
 */
function balancedAssign(labs: readonly Lab[], refs: readonly Lab[], cap: number, lock: readonly number[] | null): number[] {
  const m = labs.length;
  const cost: number[][] = new Array(m);
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(m);
    for (let j = 0; j < m; j++) {
      const label = Math.floor(j / cap);
      const locked = lock ? lock[i] : -1;
      row[j] = locked >= 0 && locked !== label ? LOCK_COST : labDist2(labs[i], refs[label]);
    }
    cost[i] = row;
  }
  return hungarian(cost).map((col) => Math.floor(col / cap));
}

/** 按标签求均值(3 维向量,Lab 或线性 RGB 都能喂)。 */
function meanByLabel(vecs: readonly (readonly number[])[], assign: readonly number[], k: number): number[][] {
  const sum = Array.from({ length: k }, () => [0, 0, 0]);
  const cnt = new Array<number>(k).fill(0);
  assign.forEach((label, i) => {
    sum[label][0] += vecs[i][0];
    sum[label][1] += vecs[i][1];
    sum[label][2] += vecs[i][2];
    cnt[label]++;
  });
  return sum.map((s, i) => (cnt[i] ? [s[0] / cnt[i], s[1] / cnt[i], s[2] / cnt[i]] : [0, 0, 0]));
}

const meanOf = (vecs: readonly (readonly number[])[]): number[] => meanByLabel(vecs, vecs.map(() => 0), 1)[0];

/** 确定性的 maximin 播种,返回样本下标:先取离整体均值最远的,之后每次取「离已选点最近距离」最大的。 */
function maximinSeeds(labs: readonly Lab[], k: number): number[] {
  const mean = meanOf(labs) as unknown as Lab;
  const seeds: number[] = [labs.reduce(
    (acc, l, i) => (labDist2(l, mean) > acc.d ? { d: labDist2(l, mean), i } : acc), { d: -1, i: 0 },
  ).i];
  while (seeds.length < k) {
    let pick = 0, pickD = -1;
    for (let i = 0; i < labs.length; i++) {
      let near = Infinity;
      for (const s of seeds) near = Math.min(near, labDist2(labs[i], labs[s]));
      if (near > pickD) { pickD = near; pick = i; }
    }
    seeds.push(pick);
  }
  return seeds;
}

/** 收缩系数:每面只有 n² 个样本、增益却有 3 个自由度,不往 1 拉会把真实色差也「解释」掉。 */
const GAIN_SHRINK = 0.35;

/**
 * 每面重新拟合一组线性增益,使 gain·(原始线性色) 最贴近该格判定色的参照值(逐通道最小二乘,
 * 亮通道自然占权重大;再往 1 收缩一档,并夹在 [0.3, 3] 内防止个别高光把整面拽跑)。
 */
function fitGains(
  lin: readonly (readonly number[])[], refsLin: readonly number[][], assign: readonly number[],
  per: number, gains: number[][],
): void {
  for (let f = 0; f < gains.length; f++) {
    for (let c = 0; c < 3; c++) {
      let num = 0, den = 0;
      for (let k = 0; k < per; k++) {
        const i = f * per + k;
        num += refsLin[assign[i]][c] * lin[i][c];
        den += lin[i][c] * lin[i][c];
      }
      gains[f][c] = den < 1e-6
        ? 1
        : Math.min(3, Math.max(0.3, (num + GAIN_SHRINK * den) / (den * (1 + GAIN_SHRINK))));
    }
  }
}

/** 灰世界预归一:把每面的均值拉到全局均值 —— 只用来播种,给交替优化多一个不同的起点。 */
function grayWorld(lin: readonly (readonly number[])[], per: number): number[][] {
  const all = meanOf(lin);
  return lin.map((c, i) => {
    const face = meanOf(lin.slice(Math.floor(i / per) * per, Math.floor(i / per) * per + per));
    return c.map((v, k) => (face[k] > 1e-6 ? (v * all[k]) / face[k] : v));
  });
}

interface Alternation {
  assign: number[];
  refsLin: number[][];
  corrected: number[][];
  /** 残差 = 每格到判定色的平均加权 Lab 距离²(收缩 + 夹取已经压住了「靠拉增益作弊」)。 */
  cost: number;
}

/** 指派 ↔ (参照色, 每面增益) 交替优化,直到指派不再变化。 */
function alternate(
  lin: readonly number[][], refs0: readonly number[][], per: number, lock: readonly number[] | null,
): Alternation {
  const gains = Array.from({ length: 6 }, () => [1, 1, 1]);
  let refsLin = refs0.map((r) => [...r]);
  let assign: number[] = [];
  let corrected = lin.map((c) => [...c]);
  for (let iter = 0; iter < 12; iter++) {
    corrected = lin.map((c, i) => {
      const g = gains[Math.floor(i / per)];
      return [c[0] * g[0], c[1] * g[1], c[2] * g[2]];
    });
    const next = balancedAssign(corrected.map(linearToLab), refsLin.map(linearToLab), per, lock);
    const stable = assign.length > 0 && next.every((v, i) => v === assign[i]);
    assign = next;
    if (stable) break;
    refsLin = meanByLabel(corrected, assign, 6);
    fitGains(lin, refsLin, assign, per, gains);
  }
  const refsLab = refsLin.map(linearToLab);
  const labs = corrected.map(linearToLab);
  const cost = labs.reduce((a, l, i) => a + labDist2(l, refsLab[assign[i]]), 0) / labs.length;
  return { assign, refsLin, corrected, cost };
}

/**
 * 给 6 个簇起名(二阶用)。两边(实拍质心 / 标准配色)各自去均值再按整体尺度归一,然后 6×6
 * 指派 —— 比的是「谁相对更红」而不是「够不够红」,整体偏色 / 欠饱和都不影响。
 */
function nameClusters(refs: readonly Lab[]): number[] {
  const canonical = PHOTO_FACES.map((f) => srgbToLab(CANONICAL_RGB[f]));
  const norm = (set: readonly Lab[]): Lab[] => {
    const c = meanOf(set);
    const dev = set.map((l) => [(l[0] - c[0]) * L_WEIGHT, l[1] - c[1], l[2] - c[2]] as Lab);
    const scale = Math.sqrt(dev.reduce((a, d) => a + d[0] * d[0] + d[1] * d[1] + d[2] * d[2], 0) / set.length) || 1;
    return dev.map((d) => [d[0] / scale, d[1] / scale, d[2] / scale] as Lab);
  };
  const a = norm(refs);
  const b = norm(canonical);
  // norm 已经把 L 乘过权重了,这里用裸欧氏距离,别再压一次。
  const cost = a.map((x) => b.map((y) => (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2));
  return hungarian(cost);
}

// ── 主入口 ───────────────────────────────────────────────────────────────────────────────────

export interface ScanResult {
  /** URFDLB facelet(6·n² 个面字母)。 */
  facelet: string;
  /** 与 facelet 同序的取样色 —— UI 用来展示「相机看到的」。 */
  samples: RGB[];
  /** 每格的判定余量(第二近参照色 − 判定色的距离,Lab 单位),越小越可疑。 */
  margin: number[];
  /** 余量偏小、建议人工复核的格子下标。 */
  uncertain: number[];
}

/**
 * 6 张照片的取样色 → facelet。`shots` 与 SCAN_STEPS 同序,每张 n² 个(拍摄时的行主序)。
 * 只保证「颜色分组」正确,**不**保证状态物理合法 —— 合法性交给调用方的 validate(拍歪 / 拍错面
 * 会在那里报出来,用户回画板改两格即可)。
 */
export function classifyScan(shots: ReadonlyArray<readonly RGB[]>, n: number): ScanResult {
  if (n !== 2 && n !== 3) throw new Error(`unsupported cube order ${n}`);
  if (shots.length !== SCAN_STEPS.length) throw new Error(`expected ${SCAN_STEPS.length} shots, got ${shots.length}`);
  const per = n * n;

  const samples = new Array<RGB>(6 * per);
  SCAN_STEPS.forEach((step, i) => {
    if (shots[i].length !== per) throw new Error(`shot ${i}: expected ${per} samples, got ${shots[i].length}`);
    const grid = rotateGrid(shots[i], n, step.rot);
    const base = PHOTO_FACES.indexOf(step.face) * per;
    for (let k = 0; k < per; k++) samples[base + k] = grid[k];
  });

  // 三阶:中心块 = 该面颜色的定义 → 既当初始参照色,也在指派里锁死。
  const anchored = n === 3;
  const centerOf = (per - 1) / 2;
  const lock = anchored
    ? samples.map((_, i) => (i % per === centerOf ? Math.floor(i / per) : -1))
    : null;

  // 每面一张照片,各有各的曝光与色温 → 每面配一组线性增益,与指派交替拟合(冯·克里斯对角适应)。
  // 交替优化只保证收敛到局部最优,所以从几个互不相同的起点各跑一遍,取残差最小的那个解。
  const lin = samples.map(srgbToLinear);
  const seeds: number[][][] = [];
  if (anchored) seeds.push(PHOTO_FACES.map((_, f) => lin[f * per + centerOf]));
  seeds.push(maximinSeeds(lin.map(linearToLab), 6).map((i) => lin[i]));
  seeds.push(PHOTO_FACES.map((f) => srgbToLinear(CANONICAL_RGB[f])));
  seeds.push(maximinSeeds(grayWorld(lin, per).map(linearToLab), 6).map((i) => lin[i]));

  const best = seeds
    .map((refs0) => alternate(lin, refs0, per, lock))
    .reduce((a, b) => (b.cost < a.cost ? b : a));
  let { assign } = best;
  const labs = best.corrected.map(linearToLab);
  let refs = best.refsLin.map(linearToLab);
  if (!anchored) {
    const perm = nameClusters(refs); // perm[簇] = 面下标
    assign = assign.map((c) => perm[c]);
    const named = new Array<Lab>(6);
    perm.forEach((face, cluster) => { named[face] = refs[cluster]; });
    refs = named;
  }

  const margin = labs.map((l, i) => {
    const mine = Math.sqrt(labDist2(l, refs[assign[i]]));
    let other = Infinity;
    for (let f = 0; f < 6; f++) if (f !== assign[i]) other = Math.min(other, Math.sqrt(labDist2(l, refs[f])));
    return other - mine;
  });

  return {
    facelet: assign.map((f) => PHOTO_FACES[f]).join(''),
    samples,
    margin,
    uncertain: margin.map((v, i) => (v < UNCERTAIN_MARGIN ? i : -1)).filter((i) => i >= 0),
  };
}
