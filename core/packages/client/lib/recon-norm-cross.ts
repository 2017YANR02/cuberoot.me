/**
 * Cross 标准化引擎——1:1 移植自 D:\cube\solver_wip\norm_cross\norm_cross.cpp
 * 算法（与几何代数版不同）：
 *   1. 正向遍历 token，维护 state.p[slot] = 当前 slot 上的原始 face id。
 *   2. 旋转只改 state.p；面转动只追加 history（记录 (原始 face, amount)，不改 state.p）。
 *   3. 宽转动按 C++ switch 表分解为「先旋转 + 记录 counter slot」。
 *   4. 末尾用 BFS（≤2 步）找到把 identity 变成 state 的最简转体序列作为 prefix。
 *   5. 输出每个 history move 时，查 face→当前 slot，emit 该 slot 名 + 后缀。
 */

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

function processToken(token: string, state: number[], history: RecordedMove[]) {
  if (!token) return;
  const base = token[0];

  // amount 检测——对齐 C++：先看是否含 '2'，否则看是否含 "'"
  let amount = 1;
  if (token.includes('2')) amount = 2;
  else if (token.includes("'")) amount = 3;

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
    history.push({ originalFace: state[SLICE_REF[base]], amount, slice: true });
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

/** 把一条记录还原成当前朝向下的写法。面转查 slot 名,中层查参照面落到哪个 slot。 */
function emit(m: RecordedMove, orig2slot: number[]): string {
  const slot = orig2slot[m.originalFace];
  if (!m.slice) return FACE_NAMES[slot] + suffix(m.amount);
  const [family, flipped] = SLOT_TO_SLICE[slot];
  return family + suffix(flipped ? (4 - m.amount) % 4 : m.amount);
}

/**
 * 标准化输入 token 序列。
 * 输出：[...prefix rotations, ...face moves]，全部为单层 + 整体转体。
 */
export function normalize(tokens: string[]): string[] {
  const state = [0, 1, 2, 3, 4, 5];
  const history: RecordedMove[] = [];
  for (const tok of tokens) processToken(tok, state, history);

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
export function normalizeLines(linesOfTokens: string[][]): {
  prefix: string[];
  perLine: string[][];
} {
  const state = [0, 1, 2, 3, 4, 5];
  const perLineHistory: RecordedMove[][] = [];
  for (const toks of linesOfTokens) {
    const hist: RecordedMove[] = [];
    for (const tok of toks) processToken(tok, state, hist);
    perLineHistory.push(hist);
  }

  const prefix = solveSimplification(state);
  const orig2slot = [0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) orig2slot[state[s]] = s;

  const perLine = perLineHistory.map(hist => hist.map(m => emit(m, orig2slot)));
  return { prefix, perLine };
}
