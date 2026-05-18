/**
 * 2x2 上帝之数现场 BFS。
 *
 * 固定 DLB 不动 ⇒ 7 个可动角块,7! × 3⁶ = 3,674,160 状态。
 * 编码: index = rank(perm) × 729 + 朝向 base-3 码,范围 0..3674159。
 * 距离表用 Uint8Array(3,674,160) ≈ 3.5 MB。
 *
 * 移动定义后续与已知 HTM 距离分布对比验证:
 *   [1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644]
 * 总和 3,674,160 ⇒ 上帝之数 11。
 *
 * 主线程消息:
 *   { type: 'progress', depth, count, elapsedMs }
 *   { type: 'done', distribution: number[], diameter, elapsedMs, antipodes: number[] }
 *     antipodes 用 index 编码,挑前 16 个回主线程展示。
 */

const N_STATES = 3_674_160; // 5040 × 729

/** 6 个槽位之外的 7 个角块槽: 0=URF, 1=ULF, 2=ULB, 3=URB, 4=DRF, 5=DLF, 6=DRB。DLB 锚定。
 *  移动定义:cycle=[a,b,c,d] 表示槽 a 的角块走到槽 b,b→c,c→d,d→a。 */
type MoveDef = { cycle: [number, number, number, number]; twist: [number, number, number, number] };

const BASE: Record<string, MoveDef> = {
  U: { cycle: [0, 1, 2, 3], twist: [0, 0, 0, 0] },
  R: { cycle: [0, 3, 6, 4], twist: [2, 1, 2, 1] },
  F: { cycle: [0, 4, 5, 1], twist: [1, 2, 1, 2] },
};

/* ───── perm rank (Lehmer code) for 7 elements ────────────────────── */

const FACT: number[] = [1, 1, 2, 6, 24, 120, 720, 5040];

function rankPerm(p: Uint8Array): number {
  // Lehmer code in O(n²) — fine for n=7
  let r = 0;
  for (let i = 0; i < 7; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 7; j++) if (p[j] < p[i]) smaller++;
    r += smaller * FACT[6 - i];
  }
  return r;
}

function unrankPerm(rank: number): Uint8Array {
  const p = new Uint8Array(7);
  const left: number[] = [0, 1, 2, 3, 4, 5, 6];
  for (let i = 0; i < 7; i++) {
    const f = FACT[6 - i];
    const idx = Math.floor(rank / f);
    rank %= f;
    p[i] = left[idx];
    left.splice(idx, 1);
  }
  return p;
}

function rankOrient(o: Uint8Array): number {
  let r = 0;
  for (let i = 0; i < 6; i++) r = r * 3 + o[i];
  return r;
}

function unrankOrient(code: number): Uint8Array {
  // o[6] = (-sum(o[0..5])) mod 3 (constraint)
  const o = new Uint8Array(7);
  for (let i = 5; i >= 0; i--) { o[i] = code % 3; code = Math.floor(code / 3); }
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += o[i];
  o[6] = (3 - (sum % 3)) % 3;
  return o;
}

function encode(p: Uint8Array, o: Uint8Array): number {
  return rankPerm(p) * 729 + rankOrient(o);
}

function decode(idx: number): { p: Uint8Array; o: Uint8Array } {
  const rp = Math.floor(idx / 729);
  const ro = idx % 729;
  return { p: unrankPerm(rp), o: unrankOrient(ro) };
}

/* ───── apply move ─────────────────────────────────────────────────── */

/** Apply BASE move definition (90° CW) `times` ∈ {1,2,3} times. */
function applyMove(p: Uint8Array, o: Uint8Array, def: MoveDef, times: number): { p: Uint8Array; o: Uint8Array } {
  let cp = p.slice();
  let co = o.slice();
  for (let t = 0; t < times; t++) {
    const np = cp.slice();
    const no = co.slice();
    const [a, b, c, d] = def.cycle;
    const [ta, tb, tc, td] = def.twist;
    // new[b] = old[a], etc.
    np[b] = cp[a]; no[b] = (co[a] + ta) % 3;
    np[c] = cp[b]; no[c] = (co[b] + tb) % 3;
    np[d] = cp[c]; no[d] = (co[c] + tc) % 3;
    np[a] = cp[d]; no[a] = (co[d] + td) % 3;
    cp = np; co = no;
  }
  return { p: cp, o: co };
}

/** 9 个 HTM 生成元:U, U2, U', R, R2, R', F, F2, F'。 */
const HTM_MOVES: { name: string; def: MoveDef; times: number }[] = [];
for (const face of ['U', 'R', 'F'] as const) {
  for (const t of [1, 2, 3]) {
    HTM_MOVES.push({
      name: face + (t === 1 ? '' : t === 2 ? '2' : "'"),
      def: BASE[face],
      times: t,
    });
  }
}

/* ───── BFS ────────────────────────────────────────────────────────── */

function bfs(): void {
  const startMs = performance.now();
  const dist = new Uint8Array(N_STATES);
  // 0 means "unvisited"; we'll use sentinel 0xFF for solved
  dist.fill(0xff);

  // 还原态 = perm [0,1,2,3,4,5,6], orient all 0
  const solvedP = new Uint8Array([0, 1, 2, 3, 4, 5, 6]);
  const solvedO = new Uint8Array([0, 0, 0, 0, 0, 0, 0]);
  const solvedIdx = encode(solvedP, solvedO);
  dist[solvedIdx] = 0;

  let frontier: Int32Array = new Int32Array([solvedIdx]);
  let depth = 0;
  const distribution: number[] = [1];
  postMessage({ type: 'progress', depth: 0, count: 1, elapsedMs: 0, totalSoFar: 1 });

  while (frontier.length > 0) {
    depth++;
    const next: number[] = [];
    for (let i = 0; i < frontier.length; i++) {
      const idx = frontier[i];
      const { p, o } = decode(idx);
      for (const mv of HTM_MOVES) {
        const r = applyMove(p, o, mv.def, mv.times);
        const ni = encode(r.p, r.o);
        if (dist[ni] === 0xff) {
          dist[ni] = depth;
          next.push(ni);
        }
      }
    }
    if (next.length === 0) break;
    distribution.push(next.length);
    frontier = new Int32Array(next);
    postMessage({
      type: 'progress',
      depth,
      count: next.length,
      elapsedMs: Math.round(performance.now() - startMs),
      totalSoFar: distribution.reduce((a, b) => a + b, 0),
    });
  }

  // 选 antipodes(最大距离层)前 16 个 index 回主线程,用于可视化
  const diameter = distribution.length - 1;
  const antipodes: number[] = [];
  for (let i = 0; i < N_STATES && antipodes.length < 16; i++) {
    if (dist[i] === diameter) antipodes.push(i);
  }

  postMessage({
    type: 'done',
    distribution,
    diameter,
    elapsedMs: Math.round(performance.now() - startMs),
    antipodes,
  });
}

/* ───── worker entry ───────────────────────────────────────────────── */

self.onmessage = (ev: MessageEvent) => {
  if (ev.data?.type === 'start') {
    bfs();
  } else if (ev.data?.type === 'decode') {
    // 把一个 antipode index 解码成 (perm, orient) 数组,主线程再翻译成 alg
    const { p, o } = decode(ev.data.idx as number);
    postMessage({ type: 'decoded', idx: ev.data.idx, perm: Array.from(p), orient: Array.from(o) });
  }
};

// 防止 TS6133:isolatedModules
export {};
