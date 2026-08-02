/**
 * 顶层「朝向」—— 同一个 case 的翻色形状指向哪一边。
 *
 * ZBLL 的 U 组有 72 个 case,但它们的 OLL 形状只有一种:两枚黄角贴纸并排在某一侧面。
 * 训练器给打乱补一个随机收尾 AUF(`trainer-scramble` 的 post-AUF),这枚黄条于是每次
 * 指向不同方向 —— 练的是识别。但有人要反过来:只练「黄条朝上」那一种(先把一个方向
 * 练熟再换)。要支持这件事,就得回答「补哪个 U 会让形状指向哪边」。
 *
 * ## 判据:顶层的顶色掩码
 *
 * 不去认「U / T / Pi / H …」这些名字(那是 3 阶 OLL 专有的一套叫法,COLL / CMLL /
 * ELL / 2 阶 CLL 各有各的说法),直接读**顶层哪些格是顶色**:
 *
 *   - 顶面 n² 格;
 *   - 四个侧面紧贴顶面那一排(每面 n 格)。
 *
 * 逐格记 1/0 得到一个 3 阶 21 位、2 阶 12 位的掩码。它就是 OLL 识别图上的那张图
 * (`view=oll` + `ngs` 画的正是这些格),所以「掩码相同 = 看上去一模一样」。
 *
 * 收尾补一个 U,掩码整体转一格({@link rotateMask});补四个回到原样。于是:
 *
 *   - **一个 case 的四种朝向** = 掩码轮换里的四项(H 组这类 2 重对称的只有两项不同);
 *   - **朝向组** = 轮换里最小的那个掩码(取 base36 当键)。这个键与从哪一相位算起无关,
 *     所以同一形状的 case 无论库里怎么摆都落到同一组 —— ZBLL 的 U 组 72 条、COLL 的
 *     U 组 6 条、OLL 的 U(23)一条,算出来是同一个键,朝向偏好因此天然通用。
 *
 * 全部朝向都相同(PLL:顶层全黄)时轮换只有一项 —— 这种 set 没有「朝向」可言,调用方
 * 据 `distinct === 1` 把整个入口藏掉,而不是摆一个点了没反应的控件。
 *
 * ## 为什么用 visualcube 的 CubeData 模拟
 *
 * 它就是画那张 case 图的引擎(`components/VisualCube` 的 `local` 分支同一个函数),
 * 记号支持面最广(`x y z` 整体旋转、`M E S`、宽层、`(…)3` 重复组都认)。用别的模拟器
 * 算、拿这个引擎画,两边迟早对不上。顶色不写死成「黄」,而是取顶面中心格所属的面
 * (2 阶没有中心,取底面多数色的对面)—— 库里不少 setup 带整体旋转,写死就全错。
 */
import { CubeData, parseAlgorithm, Face } from '@cuberoot/visualcube';

/** 收尾 AUF 的四种可能,索引 = 补几个 U。与 `trainer-scramble` 的 AUF 表同序。 */
export const ORI_AUF = ['', 'U', 'U2', "U'"] as const;

/** 侧面在掩码里的排列顺序。U 转一格 = 这四段整体挪一位(见 {@link rotateMask})。 */
const SIDE_FACES = [Face.B, Face.L, Face.F, Face.R] as const;

/** 用户的朝向偏好:朝向组键 → 允许的相位偏移(相对该组规范掩码转了几次 U)。 */
export type OrientationSel = Readonly<Record<string, readonly number[]>>;

export interface OriCycle {
  /** 朝向组键 = 轮换里最小掩码的 base36。跨 set 通用(同形状同键)。 */
  key: string;
  /** masks[k] = 打乱尾巴补 k 个 U 之后的顶层掩码。 */
  masks: readonly number[];
  /** offs[k] = masks[k] 相对规范掩码转了几次 U(同掩码取最小的那个,H 组因此只出 0/1)。 */
  offs: readonly number[];
  /** 本组有几种看得出区别的朝向:1(无朝向可言)/ 2(2 重对称)/ 4。 */
  distinct: number;
}

/** 3 阶 21 位、2 阶 12 位都在 32 位内;更大的阶数位不够,也没有 LL 训练场景。 */
export function oriSupportedSize(size: number): boolean {
  return size === 2 || size === 3;
}

/**
 * 只看角块的 set:CMLL 的 M 层没解开,库里那张 case 图把顶层棱整片压灰(`CaseThumb` 的
 * `CORNER_LL_MASK`)—— 图上看不见的东西不能进朝向判据,否则同一个「Pi 右杠」会因为
 * 恰好摆到的棱不同裂成好几组(实测 42 条 CMLL 裂成 23 组,压掉棱后回到 8 组)。
 *
 * COLL 不在此列:它的顶层棱全是翻好的(恒顶色),算不算都一样,那就让它跟 ZBLL / OLL
 * 用同一套键 —— 同一个形状在哪套里都是同一组,朝向偏好因此通用。
 */
export function oriCornersOnly(puzzle: string, set: string | null | undefined): boolean {
  return puzzle === '3x3' && set === 'cmll';
}

/** 角块格的位掩码:顶面四角 + 每条侧排的两端。2 阶全是角,恒等于全 1。 */
function cornerBits(size: number): number {
  let bits = 0;
  let bit = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++, bit++) {
      if ((r === 0 || r === size - 1) && (c === 0 || c === size - 1)) bits |= 1 << bit;
    }
  }
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < size; i++, bit++) if (i === 0 || i === size - 1) bits |= 1 << bit;
  }
  return bits;
}

/** 顶面所属的面 id。奇数阶取中心格;偶数阶没有中心,取底面多数格的对面。 */
function topFaceOf(cd: CubeData, size: number): number {
  const n2 = size * size;
  const faceOf = (id: number) => Math.floor((id - 1) / n2);
  if (size % 2 === 1) return faceOf(cd.faces[Face.U][(n2 - 1) / 2] as number);
  const tally = new Map<number, number>();
  for (const id of cd.faces[Face.D] as number[]) {
    const f = faceOf(id);
    tally.set(f, (tally.get(f) ?? 0) + 1);
  }
  let best = Face.D as number;
  let bestN = -1;
  for (const [f, n] of tally) if (n > bestN) { bestN = n; best = f; }
  // visualcube 的 Face 顺序是 U R F D L B —— 对面恒等于 (f + 3) % 6。
  return (best + 3) % 6;
}

/** 打乱跑一遍,读出顶层掩码:顶面 n² 格 + 四侧贴顶那排(每面 n 格)。算不了返 null。 */
function maskOf(alg: string, size: number): number | null {
  let cd: CubeData;
  try {
    cd = new CubeData(size);
    for (const t of parseAlgorithm(alg)) cd.turn(t);
  } catch {
    return null; // 记号不认识:不猜,调用方按「没有朝向信息」处理
  }
  const n2 = size * size;
  const top = topFaceOf(cd, size);
  const faceOf = (id: number) => Math.floor((id - 1) / n2);
  let mask = 0;
  let bit = 0;
  for (let i = 0; i < n2; i++, bit++) {
    if (faceOf(cd.faces[Face.U][i] as number) === top) mask |= 1 << bit;
  }
  // CubeData 每个面的前 size 格恰好是贴着顶面的那一排(见 simulation.ts 的编号图)。
  for (const f of SIDE_FACES) {
    for (let i = 0; i < size; i++, bit++) {
      if (faceOf(cd.faces[f][i] as number) === top) mask |= 1 << bit;
    }
  }
  return mask;
}

/**
 * 掩码转一格(= 打乱尾巴多补一个 U)。顶面按顺时针转 90°,四侧那圈整体挪一位。
 *
 * 侧环取 [B, L, F, R] 的顺序:U 顺时针时 L 的顶排转到 B、F 转到 L、R 转到 F、B 转到 R,
 * 也就是 `new[s] = old[s+1]`。排内下标不动 —— CubeData 每个面都按各自的外向阅读序编号,
 * 绕一圈正好首尾相接(`tests/alg_ll_orientation.test.ts` 拿模拟器逐 case 验过)。
 */
export function rotateMask(mask: number, size: number): number {
  const n2 = size * size;
  let out = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (mask & (1 << ((size - 1 - c) * size + r))) out |= 1 << (r * size + c);
    }
  }
  for (let s = 0; s < 4; s++) {
    const dst = n2 + s * size;
    const src = n2 + ((s + 1) % 4) * size;
    for (let i = 0; i < size; i++) if (mask & (1 << (src + i))) out |= 1 << (dst + i);
  }
  return out;
}

// 一场 1LLL 三千多个 case 全算一遍要几百毫秒,而设置面板每开一次都要全量分组 ——
// 按 (阶数, 打乱) 记住即可,同一个 case 换 pre-AUF 只多四个条目。
const cycleCache = new Map<string, OriCycle | null>();
const CYCLE_CACHE_MAX = 40000;

/**
 * 一条打乱的朝向轮换。`base` 是**收尾 AUF 之前**的那段(pre-AUF 也要含进来 ——
 * 起手的 U 同样会挪相位),返回 null = 这阶不支持 / 记号解析不了。
 * `corners` 见 {@link oriCornersOnly}。
 */
export function orientationCycle(base: string, size: number, corners = false): OriCycle | null {
  if (!oriSupportedSize(size)) return null;
  const alg = base.trim();
  const ck = `${size}${corners ? 'c' : ''}|${alg}`;
  const hit = cycleCache.get(ck);
  if (hit !== undefined) return hit;

  let result: OriCycle | null = null;
  let m0 = maskOf(alg, size);
  if (m0 !== null) {
    if (corners) m0 &= cornerBits(size);
    const masks = [m0, 0, 0, 0];
    for (let k = 1; k < 4; k++) masks[k] = rotateMask(masks[k - 1], size);
    const canon = Math.min(...masks);
    const offs = masks.map(m => {
      // 相对规范掩码转几次到 m;2 重对称的形状有两个解,取小的那个。
      let cur = canon;
      for (let d = 0; d < 4; d++) {
        if (cur === m) return d;
        cur = rotateMask(cur, size);
      }
      return 0;
    });
    // 键带上判据前缀:只看角 / 看整层算出来的数值撞车了也不会串到同一组。
    const key = (corners ? 'c' : '') + canon.toString(36);
    result = { key, masks, offs, distinct: new Set(masks).size };
  }
  if (cycleCache.size >= CYCLE_CACHE_MAX) cycleCache.clear();
  cycleCache.set(ck, result);
  return result;
}

/**
 * 按用户的朝向偏好筛出还能用的收尾 AUF。返回 null = 不限制(调用方照旧四选一):
 * 这一组没设偏好、阶数不支持、或者筛完一个不剩(设置与实际打乱对不上时宁可全放,
 * 也不能出不了题)。
 */
export function allowedPostAuf(
  base: string, size: number, sel: OrientationSel | undefined, corners = false,
): readonly string[] | null {
  if (!sel) return null;
  const cyc = orientationCycle(base, size, corners);
  if (!cyc || cyc.distinct < 2) return null;
  const want = sel[cyc.key];
  if (!want || want.length === 0) return null;
  const out = ORI_AUF.filter((_, k) => want.includes(cyc.offs[k]));
  // 一个不剩 = 偏好与这条打乱对不上;全中 = 等于没筛。两种都退回不限制。
  return out.length > 0 && out.length < ORI_AUF.length ? out : null;
}
