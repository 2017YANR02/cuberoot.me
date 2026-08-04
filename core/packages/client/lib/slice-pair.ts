/**
 * 一个中层 = 一对相对面 + 一次整体旋转。
 * =========================================================================
 *
 * `M' ≡ R' L x`。这条恒等式两个方向都在用,而且是站里两处**互为逆运算**的功能:
 *
 *   - **→ 中层**(`timer/_lib/reconstruct/humanize.ts`):智能魔方的编码器装在中心核
 *     上,报的是「这一层相对核心转了多少」。做 `S` 的时候核心跟着中层转过去,于是
 *     前后两层各自相对核心动了一下 —— 魔方报 `F' B`,而且**后面每一手都被换了名**。
 *     重写器要把那一对认回一个 `S`,并且把换名消掉。
 *   - **→ 相对面**(`lib/recon-norm-cross.ts`):/recon 详情页那个 ⇄ 按钮把十字段
 *     写成纯单层转 + 一个前缀转体,方便和十字求解器的输出对齐。`M'` 得展开成
 *     `R' L x` —— 那个 `x` 不能省,省了后面每一步就都错位了。
 *
 * 两边共用这一张表,因为它们共用的是**同一个事实**;各写一份的失败方式是符号写反,
 * 而符号写反的表现是「谱子看着像公式但拧出来不对」,比缺一个记号难发现得多。
 *
 * 表本身是**搜出来的**:`tests/humanize.test.ts` 拿魔方模型枚举六个面 × 三种量 ×
 * 九个中层 × 九个转体,逐条核对下面每一行。所以这里写错一个撇号会红,不会静默。
 */

/**
 * 一条事实,读作 **`a b ≡ slice rotation`**。
 *
 * 相对面可交换,所以 `b a` 同样成立 —— `sliceSplitTable()` 因此有 18 条而不是 9 条。
 */
export interface SlicePair {
  /** 中层记号,如 `M'`。 */
  slice: string;
  /** 相对面那一对里先报的一手。 */
  a: string;
  /** 另一手。 */
  b: string;
  /** 这一对比中层多出来的那次整体旋转 —— 也就是核心转过去的量。 */
  rotation: string;
}

export const SLICE_PAIRS: readonly SlicePair[] = Object.freeze([
  { slice: 'M', a: 'R', b: "L'", rotation: 'x' },
  { slice: "M'", a: "R'", b: 'L', rotation: "x'" },
  { slice: 'M2', a: 'R2', b: 'L2', rotation: 'x2' },
  { slice: 'E', a: 'U', b: "D'", rotation: 'y' },
  { slice: "E'", a: "U'", b: 'D', rotation: "y'" },
  { slice: 'E2', a: 'U2', b: 'D2', rotation: 'y2' },
  { slice: 'S', a: "F'", b: 'B', rotation: "z'" },
  { slice: "S'", a: 'F', b: "B'", rotation: 'z' },
  { slice: 'S2', a: 'F2', b: 'B2', rotation: 'z2' },
]);

/** 单个记号取逆。`x2` 自逆。 */
function invertToken(token: string): string {
  if (token.endsWith('2')) return token;
  return token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
}

export interface SliceSplit {
  /** 这一对其实是哪个中层。 */
  slice: string;
  /** 顺带把核心转了多少 —— 后面每一手被换名就是它干的。 */
  rotation: string;
}

let SPLIT_TABLE: Map<string, SliceSplit> | null = null;

/**
 * `"F B'" → { slice: "S'", rotation: 'z' }` 之类,两种顺序都收。拆不开的组合
 * (比如 `R L`、或者两边转的量不一样)不在表里 —— 那些不是中层。
 */
export function sliceSplitTable(): ReadonlyMap<string, SliceSplit> {
  if (SPLIT_TABLE) return SPLIT_TABLE;
  const t = new Map<string, SliceSplit>();
  for (const { slice, a, b, rotation } of SLICE_PAIRS) {
    t.set(`${a} ${b}`, { slice, rotation });
    t.set(`${b} ${a}`, { slice, rotation });
  }
  SPLIT_TABLE = t;
  return t;
}

export interface SliceExpansion {
  a: string;
  b: string;
  /** 展开式里跟在两手后面的那个转体。 */
  rotation: string;
}

/**
 * `M'` → `{ a: "R'", b: 'L', rotation: 'x' }`,读作 **`M' ≡ R' L x`**。
 *
 * 转体是 `SlicePair.rotation` 的逆:表里记的是 `a b ≡ slice rotation`,反解就是
 * `slice ≡ a b rotation⁻¹`。
 *
 * 转体的轴恒等于中层的轴,而那根轴上的两个面正是 `a` / `b` —— 所以这个转体放在两手
 * 前面还是后面都一样,写在后面只是因为人是这么读的。
 */
export function sliceExpansion(slice: string): SliceExpansion | null {
  const hit = SLICE_PAIRS.find(p => p.slice === slice);
  if (!hit) return null;
  return { a: hit.a, b: hit.b, rotation: invertToken(hit.rotation) };
}
