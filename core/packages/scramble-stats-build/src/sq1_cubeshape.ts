/* SQ1「复形 / cubeshape」求解器 —— 从打乱态把顶底两层还原成 square(立方体形状)所需的最少
 * slash(`/`)数;slash 之间的顶/底层转动免费、不计步;中层(equator)形状不计。
 *
 * 这是 Square-1 求解的第一步(cubeshape)。度量 = slash 数(twist),God's number = 7
 *(与 Jaap Scherphuis 的权威结论一致:170 个双层 shape、cube shape 最多 7 刀)。
 *
 * 实现:把每层编码成 12 位「piece-start」掩码(每 30° sector 一位;corner 占两 sector =
 * 第一位 1 第二位 0,edge 占一 sector = 1),对 slash 操作(交换两层右半 + 层间自由旋转)从
 * cube shape 反向 BFS 建距离表;查询时用站内已验证的 tnoodle 端口 applySq1 求出最终 shape 后查表。
 *
 * 校验:与 tnoodle 端口逐位等同的引擎 + 独立两版 BFS + Jaap 权威值三方一致(170 态 / God 7)。
 */

// ── 记号解析 + 应用(逐字移植 app/[lang]/scramble/gen/_svg/sq1_svg.ts,保持 shape 与全站渲染一致)──
const SQ1_TOKEN_RE = /(\/)|\(?\s*(-?\d+)\s*(?:,\s*|\s+|(?=-?\d))(-?\d+)\s*\)?|\(?\s*(-?\d+)\s*\)?/g;
type Sq1Tok = { slice: true } | { top: number; bot: number };

function parseSq1(alg: string): Sq1Tok[] {
  const out: Sq1Tok[] = [];
  const re = new RegExp(SQ1_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(alg)) !== null) {
    if (m[1] === '/') out.push({ slice: true });
    else if (m[2] !== undefined) out.push({ top: parseInt(m[2], 10), bot: parseInt(m[3]!, 10) });
    else out.push({ top: parseInt(m[4]!, 10), bot: 0 });
  }
  return out;
}

const SOLVED_PIECES = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15];

function applySq1(scramble: string): number[] {
  let pieces = SOLVED_PIECES.slice();
  for (const tok of parseSq1(scramble)) {
    if ('slice' in tok) {
      const next = pieces.slice();
      for (let i = 0; i < 6; i++) { const c = next[i + 12]; next[i + 12] = next[i + 6]; next[i + 6] = c; }
      pieces = next;
    } else {
      const t = ((-tok.top % 12) + 12) % 12;
      const b = ((-tok.bot % 12) + 12) % 12;
      const next = pieces.slice();
      const oldTop = pieces.slice(0, 12);
      for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
      const oldBot = pieces.slice(12, 24);
      for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
      pieces = next;
    }
  }
  return pieces;
}

// ── shape 编码:每层 12 位 piece-start 掩码 ──
// bit i = 1 表示 slot i 是某 piece 的起始(edge 或 corner 第一 sector);0 = corner 第二 sector。
// corner = 两个连续相同 piece id;故 slot i 是 corner 第二 sector ⟺ pieces[i] === pieces[i-1]。
function layerMarker(pieces: number[], base: number): number {
  let v = 0;
  for (let i = 0; i < 12; i++) {
    if (pieces[base + i] !== pieces[base + ((i + 11) % 12)]) v |= 1 << i;
  }
  return v;
}

function rot(v: number, r: number): number {
  let o = 0;
  for (let i = 0; i < 12; i++) if (v & (1 << ((i + r) % 12))) o |= 1 << i;
  return o;
}

function canon(v: number): number {
  let best = v;
  for (let r = 1; r < 12; r++) { const x = rot(v, r); if (x < best) best = x; }
  return best;
}

const bit = (v: number, i: number) => (v >> i) & 1;

// 交换两层右半(sectors 6..11)
function swapRight(top: number, bot: number): [number, number] {
  const lo = 0b000000111111; // sectors 0..5
  const hi = 0b111111000000; // sectors 6..11
  return [(top & lo) | (bot & hi), (bot & lo) | (top & hi)];
}

// goal:两层都是交替 C E C E C E C E(square),corner 起始于偶数 sector
const ALT = (() => { const m = [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1]; let v = 0; for (let i = 0; i < 12; i++) if (m[i]) v |= 1 << i; return v; })();
const ALT_CANON = canon(ALT);

const stateKey = (top: number, bot: number): number => canon(top) * 4096 + canon(bot);

export type CubeshapeTable = Map<number, number>;

/** 从 cube shape 反向 BFS,建「shape → 最少 slash 数」距离表(共 170 态,最大 7)。slash 操作 =
 *  两层各自自由旋转到合法切线(slot 0 与 6 都是 piece 起始)后交换右半。 */
export function buildCubeshapeTable(): CubeshapeTable {
  const dist: CubeshapeTable = new Map();
  const goal = stateKey(ALT_CANON, ALT_CANON);
  dist.set(goal, 0);
  let frontier = [goal];
  let d = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const k of frontier) {
      const top = Math.floor(k / 4096);
      const bot = k % 4096;
      for (let rt = 0; rt < 12; rt++) {
        const rtop = rot(top, rt);
        if (!bit(rtop, 0) || !bit(rtop, 6)) continue; // 顶层切线须落在 piece 边界(0 与 6)
        for (let rb = 0; rb < 12; rb++) {
          const rbot = rot(bot, rb);
          if (!bit(rbot, 0) || !bit(rbot, 6)) continue;
          const [nt, nb] = swapRight(rtop, rbot);
          const nk = stateKey(nt, nb);
          if (!dist.has(nk)) { dist.set(nk, d + 1); next.push(nk); }
        }
      }
    }
    frontier = next;
    d++;
  }
  return dist;
}

/** 某打乱到 cube shape 的最少 slash 数;table 不识别该 shape(理论不应发生)时返回 -1。 */
export function cubeshapeSlashes(table: CubeshapeTable, scramble: string): number {
  const pieces = applySq1(scramble);
  const k = stateKey(layerMarker(pieces, 0), layerMarker(pieces, 12));
  return table.get(k) ?? -1;
}
