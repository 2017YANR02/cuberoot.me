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

interface RecordedMove { originalFace: number; amount: number }

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

  // 单层面转动：大写且非 Xw 形式
  if (!isWideUpper && base >= 'A' && base <= 'Z') {
    const slot = charToFace(base);
    if (slot < 0) return;
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
    default: return;
  }
  applyRot(state, rotAxis, rotAmt);
  history.push({ originalFace: state[counterSlot], amount });
}

function moveStr(slot: number, amount: number): string {
  let s: string = FACE_NAMES[slot];
  if (amount === 2) s += '2';
  else if (amount === 3) s += "'";
  return s;
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
  for (const m of history) {
    out.push(moveStr(orig2slot[m.originalFace], m.amount));
  }
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

  const perLine = perLineHistory.map(hist =>
    hist.map(m => moveStr(orig2slot[m.originalFace], m.amount))
  );
  return { prefix, perLine };
}
