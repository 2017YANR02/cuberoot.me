/**
 * Cross 标准化引擎——1:1 移植自 D:\cube\solver_wip\norm_cross\norm_cross.cpp
 * 算法（与几何代数版不同）：
 *   1. 正向遍历 token，维护 state.p[slot] = 当前 slot 上的原始 face id。
 *   2. 旋转只改 state.p；面转动只追加 history（记录 (原始 face, amount)，不改 state.p）。
 *   3. 宽转动按 C++ switch 表分解为「先旋转 + 记录 counter slot」。
 *   4. 末尾用 BFS（≤2 步）找到把 identity 变成 state 的最简转体序列作为 prefix。
 *   5. 输出每个 history move 时，查 face→当前 slot，emit 该 slot 名 + 后缀。
 *
 * ## `expandSlices`:把中层也拆成单层转
 *
 * 默认 `M` 原样留着(它本来就是一手,写成中层最短)。开了 `expandSlices` 就按
 * `lib/slice-pair.ts` 那张表拆成一对相对面 + 一次转体:`M' → R' L x`。
 *
 * 那个 `x` **不能省**:`M'` 和 `R' L` 差的正是它,省掉之后这一步之后的每一手都错位。
 * 好在这里不用为它做任何特殊处理 —— 它和宽转动带的旋转走同一条路(进 `state`,
 * 末尾被 `solveSimplification` 收进 prefix,前面的面转跟着换名),而 `prefix + 重写`
 * 与原串是同一个空间置换,所以**十字行之后的内容一个字都不用动**。
 */

import { sliceExpansion } from './recon_slice';

const FACE_NAMES = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
const U = 0, L = 1, F = 2, R = 3, B = 4, D = 5;

type Axis = 'x' | 'y' | 'z';

function applyX(p: number[]) {
  const tu = p[U], tf = p[F], td = p[D], tb = p[B];
  p[U] = tf; p[B] = tu; p[D] = tb; p[F] = td;
}
function applyY(p: number[]) {
  const tf = p[F], tl = p[L], tb = p[B], tr = p[R];
  p[F] = tr; p[L] = tf; p[B] = tl; p[R] = tb;
}
function applyZ(p: number[]) {
  const tu = p[U], tr = p[R], td = p[D], tl = p[L];
  p[U] = tl; p[R] = tu; p[D] = tr; p[L] = td;
}

function applyRot(p: number[], axis: Axis, count: number) {
  let c = ((count % 4) + 4) % 4;
  for (let i = 0; i < c; i++) {
    if (axis === 'x') applyX(p);
    else if (axis === 'y') applyY(p);
    else applyZ(p);
  }
}

function eqState(a: number[], b: number[]): boolean {
  for (let i = 0; i < 6; i++) if (a[i] !== b[i]) return false;
  return true;
}

function rotStr(axis: Axis, count: number): string {
  if (count === 2) return axis + '2';
  if (count === 3) return axis + "'";
  return axis;
}

/** BFS 0~2 步求最简朝向恢复序列 */
function solveSimplification(target: number[]): string[] {
  const id = [0, 1, 2, 3, 4, 5];
  if (eqState(target, id)) return [];
  const axes: Axis[] = ['x', 'y', 'z'];
  const counts = [1, 2, 3];

  for (const a of axes) for (const c of counts) {
    const p = [...id];
    applyRot(p, a, c);
    if (eqState(p, target)) return [rotStr(a, c)];
  }
  for (const a1 of axes) for (const c1 of counts) {
    for (const a2 of axes) {
      if (a1 === a2) continue;
      for (const c2 of counts) {
        const p = [...id];
        applyRot(p, a1, c1);
        applyRot(p, a2, c2);
        if (eqState(p, target)) return [rotStr(a1, c1), rotStr(a2, c2)];
      }
    }
  }
  return [];
}

interface RecordedMove { originalFace: number; amount: number; slice?: boolean }

/**
 * 一个中层的身份完全由它的**参照面**决定,方向也跟着那个面:`M` 跟 `L`、`E` 跟 `D`、`S` 跟 `F`。
 * 所以只要记下参照面的**原始 face id**,就能和面转用同一套 `orig2slot` 还原 —— 不必给中层单开模型。
 */
const SLICE_REF: Record<string, number> = { M: L, E: D, S: F };

/** 参照面最终落在哪个 slot → 该写哪个中层,以及方向要不要反过来(落到对面就反)。 */
const SLOT_TO_SLICE: Array<readonly [string, boolean]> = [];
SLOT_TO_SLICE[L] = ['M', false]; SLOT_TO_SLICE[R] = ['M', true];
SLOT_TO_SLICE[D] = ['E', false]; SLOT_TO_SLICE[U] = ['E', true];
SLOT_TO_SLICE[F] = ['S', false]; SLOT_TO_SLICE[B] = ['S', true];

function charToFace(c: string): number {
  switch (c) {
    case 'U': return U;
    case 'L': return L;
    case 'F': return F;
    case 'R': return R;
    case 'B': return B;
    case 'D': return D;
    default: return -1;
  }
}

function processToken(
  token: string,
  state: number[],
  history: RecordedMove[],
  expandSlices = false,
) {
  if (!token) return;
  const base = token[0];

  const amount = amountOf(token);

  // wide notation 'Rw' / 'Lw' / 'Uw' 等：第二个字符是 w
  const isWideUpper = token.length > 1 && token[1] === 'w' && base >= 'A' && base <= 'Z';

  // 整体旋转 x/y/z（X/Y/Z 也容错为旋转）
  if (base === 'x' || base === 'y' || base === 'z' ||
      base === 'X' || base === 'Y' || base === 'Z') {
    applyRot(state, base.toLowerCase() as Axis, amount);
    return;
  }

  // 中层 M / E / S。旧实现没有这一支:它们走到下面的面转分支,charToFace 返 -1 就 `return`,
  // 于是招式**从 history 里凭空消失**,状态算错却不报错。实测 rotateSolutionY("M2 U M U2 M' U M2", 1)
  // 曾得到 "y U U2 U" —— 四个 M 全没了。今天没炸只因调用点喂的都是纯面转的十字解。
  if (!isWideUpper && (base === 'M' || base === 'E' || base === 'S')) {
    if (!expandSlices) {
      history.push({ originalFace: state[SLICE_REF[base]], amount, slice: true });
      return;
    }
    // `M' → R' L x`。表在 lib/slice-pair.ts,两处共用(见那个文件的头注)。
    const exp = sliceExpansion(base + suffix(amount));
    if (!exp) return;
    for (const t of [exp.a, exp.b]) {
      const slot = charToFace(t[0]);
      if (slot < 0) return;
      history.push({ originalFace: state[slot], amount: amountOf(t) });
    }
    // 转体的轴就是这个中层的轴,而那根轴上的两个面正是刚记下的两手 —— 所以先转还是
    // 后转都一样,它不会改变 `state[a]` / `state[b]`。
    applyRot(state, exp.rotation[0] as Axis, amountOf(exp.rotation));
    return;
  }

  // 单层面转动：大写且非 Xw 形式
  if (!isWideUpper && base >= 'A' && base <= 'Z') {
    const slot = charToFace(base);
    if (slot < 0) return;   // 不是招式(UFRBLD / MES / xyz / 宽块已全部在上面认掉)
    history.push({ originalFace: state[slot], amount });
    return;
  }

  // 宽转动：小写 r/l/u/d/f/b 或 Xw 形式（统一为小写 wideBase）
  const wideBase = isWideUpper ? base.toLowerCase() : base;
  let rotAxis: Axis | null = null;
  let rotAmt = 0;
  let counterSlot = -1;
  switch (wideBase) {
    case 'r': rotAxis = 'x'; rotAmt = amount; counterSlot = L; break;
    case 'l': rotAxis = 'x'; rotAmt = (4 - amount) % 4; counterSlot = R; break;
    case 'u': rotAxis = 'y'; rotAmt = amount; counterSlot = D; break;
    case 'd': rotAxis = 'y'; rotAmt = (4 - amount) % 4; counterSlot = U; break;
    case 'f': rotAxis = 'z'; rotAmt = amount; counterSlot = B; break;
    case 'b': rotAxis = 'z'; rotAmt = (4 - amount) % 4; counterSlot = F; break;
    // recon 里的注解(`[regrip]` `...`)也会走到这儿 —— 跳过它们是对的。招式已全部认掉:
    // 面转 UFRBLD、中层 MES、转体 xyz、宽块 rludfb / Xw。
    default: return;
  }
  applyRot(state, rotAxis, rotAmt);
  history.push({ originalFace: state[counterSlot], amount });
}

function suffix(amount: number): string {
  if (amount === 2) return '2';
  if (amount === 3) return "'";
  return '';
}

/** 记号后缀 → 四分之一圈数。对齐 C++：先看是否含 '2'，否则看是否含 "'"。 */
function amountOf(token: string): number {
  if (token.includes('2')) return 2;
  if (token.includes("'")) return 3;
  return 1;
}

/** 把一条记录还原成当前朝向下的写法。面转查 slot 名,中层查参照面落到哪个 slot。 */
function emit(m: RecordedMove, orig2slot: number[]): string {
  const slot = orig2slot[m.originalFace];
  if (!m.slice) return FACE_NAMES[slot] + suffix(m.amount);
  const [family, flipped] = SLOT_TO_SLICE[slot];
  return family + suffix(flipped ? (4 - m.amount) % 4 : m.amount);
}

export interface NormalizeOptions {
  /** 把 `M/E/S` 也拆成一对相对面 + 一次转体(`M' → R' L x`)。默认原样保留。 */
  expandSlices?: boolean;
}

/**
 * 标准化输入 token 序列。
 * 输出：[...prefix rotations, ...face moves]，全部为单层 + 整体转体。
 */
export function normalize(tokens: string[], opts: NormalizeOptions = {}): string[] {
  const state = [0, 1, 2, 3, 4, 5];
  const history: RecordedMove[] = [];
  for (const tok of tokens) processToken(tok, state, history, opts.expandSlices);

  const prefix = solveSimplification(state);

  const orig2slot = [0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) orig2slot[state[s]] = s;

  const out: string[] = [...prefix];
  for (const m of history) out.push(emit(m, orig2slot));
  return out;
}

/**
 * 按行标准化：每行返回该行原本的 face moves 在最终朝向下的写法，
 * 所有 rotations 合并成单一 prefix。
 */
export function normalizeLines(linesOfTokens: string[][], opts: NormalizeOptions = {}): {
  prefix: string[];
  perLine: string[][];
} {
  const state = [0, 1, 2, 3, 4, 5];
  const perLineHistory: RecordedMove[][] = [];
  for (const toks of linesOfTokens) {
    const hist: RecordedMove[] = [];
    for (const tok of toks) processToken(tok, state, hist, opts.expandSlices);
    perLineHistory.push(hist);
  }

  const prefix = solveSimplification(state);
  const orig2slot = [0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) orig2slot[state[s]] = s;

  const perLine = perLineHistory.map(hist => hist.map(m => emit(m, orig2slot)));
  return { prefix, perLine };
}

const CROSS_RE = /\b(?:p?s?x*)?cross\b/i;
const MOVE_RE = /[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g;
const TIMING_COMMENT_RE = /\(\s*\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*\s*(?:h\*)?\s*\)/gi;
const COMMENT_NOISE_RE = /(?:\.{3,}|…+|[→←↔⇄⇆⇋⇌⇔]+)/g;

function tokenizeReconMoves(input: string): string[] {
  return input.match(MOVE_RE) ?? [];
}

function splitAlgComment(line: string): { alg: string; comment: string } {
  const idx = line.indexOf('//');
  if (idx < 0) return { alg: line, comment: '' };
  return { alg: line.slice(0, idx), comment: line.slice(idx + 2) };
}

export function findCrossLineIndex(solution: string): number {
  if (!solution) return -1;
  const lines = solution.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const { comment } = splitAlgComment(lines[i]);
    if (comment && CROSS_RE.test(comment)) return i;
  }
  return -1;
}

/** 十字段里存在会被 Normalize cross 改写的宽转动或中层转动。 */
export function hasNormalizableCrossMove(solution: string): boolean {
  const idx = findCrossLineIndex(solution);
  if (idx < 0) return false;
  const lines = solution.split(/\r?\n/);
  for (let i = 0; i <= idx; i++) {
    const { alg } = splitAlgComment(lines[i]);
    for (const tok of tokenizeReconMoves(alg)) {
      const c = tok[0];
      if (tok.length > 1 && tok[1] === 'w' && c >= 'A' && c <= 'Z') return true;
      if ('rludfb'.includes(c)) return true;
      if ('MES'.includes(c) && (tok.length === 1 || tok[1] !== 'w')) return true;
    }
  }
  return false;
}

/**
 * 把开头到 cross 行统一改写成「必要前缀转体 + 单层转动」。cross 后原样保留，
 * 因为整段改写前后是同一个空间置换。
 */
export function buildNormalizedSolution(solution: string): string | null {
  if (!solution) return null;
  const lines = solution.split(/\r?\n/);
  const crossLineIdx = findCrossLineIndex(solution);
  if (crossLineIdx < 0) return null;

  const lineAlgs: string[] = [];
  const lineComments: string[] = [];
  const lineTokens: string[][] = [];
  for (let i = 0; i <= crossLineIdx; i++) {
    const { alg, comment } = splitAlgComment(lines[i]);
    lineAlgs.push(alg);
    lineComments.push(comment.trim());
    lineTokens.push(tokenizeReconMoves(alg));
  }
  if (!lineTokens.some((tokens) => tokens.length > 0)) return null;

  let result: ReturnType<typeof normalizeLines>;
  try {
    result = normalizeLines(lineTokens, { expandSlices: true });
  } catch {
    return null;
  }

  let prefixLine = lineAlgs.findIndex((alg) => alg.trim().length > 0);
  if (prefixLine < 0) prefixLine = crossLineIdx;
  const out = [...lines];
  for (let i = 0; i <= crossLineIdx; i++) {
    let alg = result.perLine[i].join(' ');
    if (i === prefixLine && result.prefix.length > 0) {
      alg = alg ? `${result.prefix.join(' ')} ${alg}` : result.prefix.join(' ');
    }
    out[i] = [alg, lineComments[i] ? `// ${lineComments[i]}` : ''].filter(Boolean).join(' ');
  }
  return out.join('\n');
}

/** 旧编辑页用：取 inspection 到 cross 的规范化片段。 */
export function extractAndNormalizeCross(solution: string): { alg: string; lineIndex: number } | null {
  const full = buildNormalizedSolution(solution);
  if (!full) return null;
  const lineIndex = findCrossLineIndex(full);
  if (lineIndex < 0) return null;
  return { alg: full.split(/\r?\n/).slice(0, lineIndex + 1).join('\n'), lineIndex };
}

/**
 * Ground truth 的展示口径：动作区只保留真转动并重新空格分词；注释保留阶段语义，
 * 但删除形如 `(2.960)` / `(0.22+0.80)` / `(18h*)` 的时间标注。
 * 这样不会把 `...`、动作括号、箭头、regrip 标点写进测试期望，同时保留 `(BO)`。
 */
export function canonicalizeReconSolution(solution: string): string {
  return solution.split(/\r?\n/).map((line) => {
    const { alg, comment } = splitAlgComment(line);
    const moves = tokenizeReconMoves(alg).join(' ');
    const cleanComment = comment
      .replace(TIMING_COMMENT_RE, '')
      .replace(COMMENT_NOISE_RE, '')
      .replace(/\s+/g, ' ')
      .trim();
    return [moves, cleanComment ? `// ${cleanComment}` : ''].filter(Boolean).join(' ');
  }).filter((line) => line.length > 0).join('\n');
}

/** 仅取复盘动作区的真转动，供播放器与“是否完整复原”校验共用。 */
export function reconAlgMoves(solution: string): string {
  return solution.split(/\r?\n/)
    .flatMap((line) => tokenizeReconMoves(splitAlgComment(line).alg))
    .join(' ');
}

export interface ReconGroundTruthText {
  truth: string;
  normalizedSolution: string;
  crossNormalized: boolean;
}

/** 站内 ground-truth 唯一文本生成入口。 */
export function buildReconGroundTruth(scramble: string, solution: string): ReconGroundTruthText {
  const normalized = buildNormalizedSolution(solution);
  const normalizedSolution = canonicalizeReconSolution(normalized ?? solution);
  return {
    truth: `${scramble.trim()}\n${normalizedSolution}`.replace(/\r\n?/g, '\n').trim(),
    normalizedSolution,
    crossNormalized: normalized !== null && normalized !== solution,
  };
}

export interface ReconCandidateMetadata {
  scramble: string;
  solution: string;
  value: string;
  rawTime: number | string | null;
}

/**
 * ground-truth 候选池的同步入口校验。这里仅判断数据库元数据；魔方状态是否完整复原
 * 仍由服务端 cubing.js 校验后追加 `source_not_solved`。
 */
export function reconCandidateMetadataBlockers(source: ReconCandidateMetadata): string[] {
  const scramble = source.scramble.trim();
  const solution = source.solution.trim();
  const result = source.value.trim();
  const blockers: string[] = [];

  if (!scramble) blockers.push('missing_scramble');
  else if (scramble.split(/\s+/).length < 10) blockers.push('short_scramble');
  if (!solution) blockers.push('missing_solution');

  const normalizedResult = result.toUpperCase();
  if (/^(?:DNF|DNS)(?:\b|\()/.test(normalizedResult)) blockers.push('dnf_or_dns');
  if (/^FAIL(?:ED|URE)?\b/.test(normalizedResult) || /\bfail(?:ed|ure)?\b/i.test(solution)) {
    blockers.push('fail_marker');
  }

  const rawTime = source.rawTime == null ? Number.NaN : Number(source.rawTime);
  if (!result || !Number.isFinite(rawTime) || rawTime <= 0) blockers.push('missing_result');
  return [...new Set(blockers)];
}
