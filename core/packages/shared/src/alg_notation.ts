/**
 * 3x3 记号的单一真源:tokenize / 计步 / 剥离 / 镜像与旋转的规则表。
 *
 * **零依赖**(不过 cubing.js)—— server 和构建脚本都要用,不能拖一个 WASM 求解器进来。
 * 需要真解析(交换子 `[R, U]`、共轭)的地方仍走 cubing.js,但**规则**只有这一份。
 *
 * ## 为什么存在
 *
 * 站上曾有九个各自为政的计步器,其中一个是错的:`lib/recon-stats.ts` 的 `htm` 用字符剥离法
 * (删掉 ` ()'xyz234·↑↓./` 后数剩余字符),剥离集里**没有 `w`** —— 于是 `Rw` 被数成 2 步。
 * 它一直不出事,只因为写小写 `r` 时碰巧对;recon 里 `Rw` 遍地都是。
 * 根因一句话:**字符法只在「宽块写小写」时正确。** 所以这里换成真 tokenizer。
 *
 * ## 度量:照写照执行,**不折 mod 4**
 *
 * `R4` 的群元素是恒等,但它是一个**真实的物理动作**(R 层转满一圈),对指法 / 手部动画 / TPS
 * 全都算数。所以:
 *
 * ```
 * STM   转体 0;其余每个写出来的 token 记 1        →  R4 = 1、R3 = 1、R2 = 1
 * SQTM  转体 0;其余记 |写出来的 amount|            →  R4 = 4、R3 = 3、R2 = 2、R' = 1
 * HTM   转体 0;slice 记 2(M = R' L x');其余记 1
 * QTM   HTM 的每一步再按 |amount| 展开
 * ETM   每个 token 记 1,**转体也算**
 * ```
 *
 * STM / SQTM 逐行复现站长那张 1LLL 表的 `SH` / `SQ` 两列(3915 行)。
 * 表把它们叫 HTM / QTM,但按定义那是 **STM / SQTM** —— 表里 slice 记 1 步,不是 2 步。
 */

export type MoveKind = 'face' | 'wide' | 'slice' | 'rotation';

export interface ParsedMove {
  /** 逐字原文,如 `3Rw2'` / `r` / `M'` */
  raw: string;
  /** 面字母,**原样大小写**:`R` / `r` / `Rw` / `M` / `x` */
  family: string;
  /** 层前缀,如 `2R` 的 `2`、`2-3r` 的 `2-3`;没写就是 undefined */
  layer?: string;
  /** 净转量,**照写不折 mod 4**:`R4'` → −4、`R2` → 2、`R'` → −1 */
  amount: number;
  kind: MoveKind;
}

const ROTATIONS = 'xyz';
const SLICES = 'MSE';
const WIDE_LOWER = 'rludfb';

/**
 * 层前缀 + 面字母 + 可选 w + 可选量 + 可选撇。**全站唯一的 move 文法。**
 *
 * 导出是为了让别的解析器(如 alg-build 的 sheet_notation)复用而不是各造一份 ——
 * 造第二份的代价实测过:少认一个 `w`,`Lw2` 就被切成 `L` + junk `w2`,整条公式静默作废。
 */
export const MOVE_RE = /^(\d+(?:-\d+)?)?([RLUDFBMSExyzrludfb])(w?)(\d*)('?)/;

/**
 * 能出现在纯 move 串里的字符,**已转义成可直接嵌进字符类的形式**(层前缀的 `-` escape 过 ——
 * 裸的尾随 `-` 拼到 `[^…\s]` 里会被当成区间端点,行为随 `u` flag 变)。
 * 用来判断「这段是招式还是散文」。
 */
export const MOVE_CHARS = "RLUDFBrludfbMSExyzw0-9'\\-";

function kindOf(base: string, wide: boolean, layer: string | undefined): MoveKind {
  if (ROTATIONS.includes(base)) return 'rotation';
  if (SLICES.includes(base)) return 'slice';
  if (wide || WIDE_LOWER.includes(base) || layer) return 'wide';
  return 'face';
}

export interface TokenizeResult {
  moves: ParsedMove[];
  /** 认不出来的片段。**绝不静默丢** —— 调用方要么报错要么原样退回。 */
  junk: string[];
}

/**
 * 把一串招式切成 token。**不展开 `(...)N`** —— 先调 `expandGroups`。
 * 输入应当已经剥净注释 / 标签 / 换握记号(见 `cubeOnly`)。
 */
export function tokenizeMoves(alg: string): TokenizeResult {
  const moves: ParsedMove[] = [];
  const junk: string[] = [];
  let i = 0;
  while (i < alg.length) {
    if (/\s/.test(alg[i])) { i++; continue; }
    const m = MOVE_RE.exec(alg.slice(i));
    if (m) {
      const [raw, layer, base, w, digits, prime] = m;
      const amount = (digits ? Number(digits) : 1) * (prime ? -1 : 1);
      moves.push({
        raw,
        family: base + w,
        ...(layer ? { layer } : {}),
        amount,
        kind: kindOf(base, w === 'w', layer),
      });
      i += raw.length;
      continue;
    }
    let j = i;
    while (j < alg.length && !/\s/.test(alg[j])) j++;
    junk.push(alg.slice(i, j));
    i = j;
  }
  return { moves, junk };
}

// ---------------------------------------------------------------- 剥离

/**
 * 换握记号 `↑ ↓ ·` → **一个空格**,不是空串。
 *
 * FINGERTRICKS §7.3 白纸黑字:「换成空格……禁粘连」。剥成空串会把 `R·U` 黏成 `RU`,
 * 而 `new Alg("RU")` **不报错** —— cubing.js 把它当成一个 family 叫 `RU` 的招式静默吃掉。
 */
export function stripGripMarks(s: string): string {
  return s.replace(/[↑↓·]/g, ' ');
}

/** FTN 注解块 `[R2:@C>Q]`(紧贴招式) */
export function stripFtnBlocks(s: string): string {
  return s.replace(/\[[^\]]*\]/g, '');
}

/** 推法糖:紧跟招式的尾缀 `p`(`U'p`) */
export function stripPushMarks(s: string): string {
  return s.replace(/(?<=\S)p(?=\s|$)/g, '');
}

/** 行注释 `// …` */
export function stripComments(s: string): string {
  return s.replace(/\/\/[^\n]*/g, '');
}

/**
 * FINGERTRICKS §7.3 的规范剥离链:invert / mirror / 反推打乱 / recon 手递前统一走它。
 * 顺序有讲究 —— 先剥注解块(里面可能含 `p` 和记号),再剥换握,最后剥推法糖。
 */
export function cubeOnly(s: string): string {
  return stripPushMarks(stripGripMarks(stripFtnBlocks(stripComments(s)))).replace(/\s+/g, ' ').trim();
}

/** 递归展开 `(...)N`(**会嵌套**)。括号不配对 → 抛。 */
export function expandGroups(s: string): string {
  type Tok = { t: 'm'; s: string } | { t: '(' } | { t: ')'; rep: number };
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') { toks.push({ t: '(' }); i++; continue; }
    if (c === ')') {
      i++;
      let d = '';
      while (i < s.length && /\d/.test(s[i])) d += s[i++];
      toks.push({ t: ')', rep: d ? Number(d) : 1 });
      continue;
    }
    let j = i;
    while (j < s.length && !'()'.includes(s[j])) j++;
    toks.push({ t: 'm', s: s.slice(i, j) });
    i = j;
  }
  let k = 0;
  const walk = (depth: number): string[] => {
    const out: string[] = [];
    while (k < toks.length) {
      const tk = toks[k];
      if (tk.t === 'm') { out.push(tk.s); k++; continue; }
      if (tk.t === '(') { k++; out.push(...walk(depth + 1)); continue; }
      k++;
      if (depth === 0) throw new Error('多出一个 ")"');
      return Array.from({ length: tk.rep }, () => out).flat();
    }
    if (depth !== 0) throw new Error('少一个 ")"');
    return out;
  };
  return walk(0).join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- 计步

export type Metric = 'stm' | 'sqtm' | 'htm' | 'qtm' | 'etm';

/** 单个 move 在某个度量下值几步。`M` 在 HTM 里是 2 步(M = R' L x'),在 STM 里是 1 步。 */
export function moveCost(m: ParsedMove, metric: Metric): number {
  if (metric === 'etm') return 1;
  if (m.kind === 'rotation') return 0;
  const turns = Math.abs(m.amount);
  switch (metric) {
    case 'stm': return 1;
    case 'sqtm': return turns;
    case 'htm': return m.kind === 'slice' ? 2 : 1;
    case 'qtm': return (m.kind === 'slice' ? 2 : 1) * turns;
  }
}

/**
 * 剥净 + 展开 `(...)N`,产出一串纯招式。**括号不配对时不抛** —— 丢掉括号照常解析。
 * (真实数据里就有:那张 1LLL 表有两行漏配对,都不带重复指数,丢括号后完全等价。)
 * 要严格校验括号,直接调 `expandGroups`,它会抛。
 */
export function flattenAlg(alg: string): string {
  const clean = cubeOnly(alg);
  try {
    return expandGroups(clean);
  } catch {
    return clean.replace(/[()]\d*/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * 归一成**解析器能直接吃**的招式串:剥净 → 展开 `(...)N` → 按 token 重新用空格拼。
 *
 * `flattenAlg` 干不了这件事 —— 它在字符串层做,**连写原样留着**。而人写的公式里连写很常见
 * (`MR` `UD` `R'M'` `E'U'`,那张 1LLL 表 167 条),`new Alg("MR")` 不报错,它会当成一个
 * 叫 `MR` 的 family 静默吃掉 —— 播出来少一步,还没人知道。tokenizeMoves 是最长匹配,
 * `MR` 只有 `M` + `R` 一种切法,这里把它切开再拼回去。
 *
 * @throws 认不出来的记号 —— **绝不静默丢**。
 */
export function toMoveString(alg: string): string {
  const { moves, junk } = tokenizeMoves(flattenAlg(alg));
  if (junk.length) throw new Error(`认不出来的记号:${junk.join(' ')}`);
  return moves.map((m) => m.raw).join(' ');
}

/**
 * 数步。认不出来的片段**跳过并不计入** —— 计步器不该因为一个杂字符就报错。
 * 要知道有没有杂字符,直接调 `tokenizeMoves` 看 `junk`。
 */
export function countMoves(alg: string, metric: Metric): number {
  if (!alg) return 0;
  return tokenizeMoves(flattenAlg(alg)).moves.reduce((n, m) => n + moveCost(m, metric), 0);
}

export const stm = (alg: string) => countMoves(alg, 'stm');
export const sqtm = (alg: string) => countMoves(alg, 'sqtm');
export const htm = (alg: string) => countMoves(alg, 'htm');
export const qtm = (alg: string) => countMoves(alg, 'qtm');
export const etm = (alg: string) => countMoves(alg, 'etm');

// ---------------------------------------------------------------- 派生

/**
 * 生成元集合:出现过的**非转体** family 字母,大小写不敏感排序。
 *
 * 同一个字母的大小写谁在前,**由它在公式里谁先出现决定**,不是「大写优先」这类规则:
 * `PLL-F` 的 `R' F R f' …` → `FfRSU`(F 先),`PLL-Y` 的 `f' U f R' …` → `fFRU`(f 先)。
 * 靠 `Array.sort` 的稳定性天然拿到 —— 输入已经是「按首次出现去重」的。
 *
 * 转写自表里的 `Self gen`,3915 行逐行吻合。
 */
export function gen(alg: string): string {
  const seen: string[] = [];
  for (const m of tokenizeMoves(flattenAlg(alg)).moves) {
    if (m.kind === 'rotation') continue;
    for (const ch of m.family) if (!seen.includes(ch)) seen.push(ch);
  }
  return seen.sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase())).join('');
}

/**
 * 剥掉起手 AUF。**token 感知**,不是正则 —— 表里的 `^U2'?|^U'|^U` 会把 `U3 …` 咬成 `3 …`,
 * 也会把 `Uw …` 咬成 `w …`。其余字符**一个不动**(换握记号周边的空格有语义)。
 */
export function deleteAuf(alg: string): string {
  const m = MOVE_RE.exec(alg.trimStart());
  if (!m || m[1] || m[2] !== 'U' || m[3]) return alg;
  const lead = alg.length - alg.trimStart().length;
  return alg.slice(lead + m[0].length).trimStart();
}

// ---------------------------------------------------------------- 镜像 / 旋转的规则表

/** 每个镜面交换的两个面,把它们的每一种宽度写法都列全。 */
export const MIRROR_SWAP = {
  M: [['R', 'L'], ['r', 'l'], ['Rw', 'Lw']],
  S: [['F', 'B'], ['f', 'b'], ['Fw', 'Bw']],
  E: [['U', 'D'], ['u', 'd'], ['Uw', 'Dw']],
} as const;

/**
 * 落在镜面**法线轴**上的那个 slice 和那个转体:**原样不动,不取反**。
 *
 * 这不是约定,是被 cubing.js 自己的 move 代数逼出来的(已实测,不是假设):
 *
 * ```
 * l = L M   且   r = R M'
 * 镜像把 L 送到 R',把 l 送到 r' = (R M')' = R' M
 * ⟹  R' · mirror(M) = R' M  ⟹  mirror(M) = M
 * 同理 x = R M' L'  ⟹  mirror(x) = L' M' R = x
 * ```
 *
 * 直觉:`M` 的方向跟着 `L` 定,`x` 的方向跟着 `R` 定 —— 而 M 平面镜像交换的正是 L 和 R。
 * 参照方向翻了一次,招式自己又翻一次,**两次抵消**。S/z 和 E/y 在各自的轴上同理。
 *
 * 反过来「全部取反」会毁掉带 `M` 或 `x` 的公式(站上 7771 条 LL 公式里 590 条;
 * 独立几何 oracle 实测 2000 条随机公式只过 1116 条)。这个错犯过两次,别来第三次。
 */
export const MIRROR_EXEMPT = { M: ['M', 'x'], S: ['S', 'z'], E: ['E', 'y'] } as const;

export type MirrorAxis = keyof typeof MIRROR_SWAP;

/** 镜像后的 family(不管 amount)。 */
export function mirrorFamily(family: string, axis: MirrorAxis): string {
  for (const [a, b] of MIRROR_SWAP[axis]) {
    if (family === a) return b;
    if (family === b) return a;
  }
  return family;
}

/** 这个 family 在这个镜面下是否**豁免取反**。 */
export function mirrorKeepsAmount(family: string, axis: MirrorAxis): boolean {
  return (MIRROR_EXEMPT[axis] as readonly string[]).includes(family);
}

/** `y` 一步的 family 重映射(`'` = amount 取反)。转写自表里的 `ROTATEY`。 */
export const ROTATE_Y: Record<string, readonly [string, 1 | -1]> = {
  R: ['F', 1], U: ['U', 1], F: ['L', 1], D: ['D', 1], B: ['R', 1], L: ['B', 1],
  r: ['f', 1], u: ['u', 1], f: ['l', 1], d: ['d', 1], b: ['r', 1], l: ['b', 1],
  Rw: ['Fw', 1], Uw: ['Uw', 1], Fw: ['Lw', 1], Dw: ['Dw', 1], Bw: ['Rw', 1], Lw: ['Bw', 1],
  x: ['z', 1], y: ['y', 1], z: ['x', -1],
  E: ['E', 1], M: ['S', -1], S: ['M', 1],
};
