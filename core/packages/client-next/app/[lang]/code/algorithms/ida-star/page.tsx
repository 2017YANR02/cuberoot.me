'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './algorithm_intro.css';

const ACCENT = '#5BA8FF';

interface Section {
  num: string;
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const SECTIONS: Section[] = [
  {
    num: '01',
    zh: {
      title: <>BFS / A* 为何不够</>,
      body: (
        <>
          <p>
            魔方状态空间 4.33×10¹⁹,直接 BFS 一遍跑完不现实。退而求其次,A* 加启发式能砍掉大量搜索树枝,
            但 A* 的 OPEN/CLOSED 列表要驻在内存里 —— 任意时刻活节点数 ≈ 解长度对应的"边界球面",
            对 20 步左右的最短解,这个球面也得 10¹² 以上,显然装不下。
          </p>
          <p>
            <strong>IDA* (Iterative Deepening A*)</strong> 的破解办法很朴素:用<strong>深度优先</strong>
            的方式跑 A*,不存 OPEN/CLOSED。空间从 O(b<sup>d</sup>) 退到 O(d),代价是同一棵子树要重复展开
            log 多次。对魔方这种 b≈13、d≤20 的小深度高分支问题,这个 trade 极其划算。
          </p>
        </>
      ),
    },
    en: {
      title: <>Why BFS / A* alone won’t cut it</>,
      body: (
        <>
          <p>
            The cube has 4.33×10¹⁹ states; a plain BFS is hopeless. A* prunes much of the tree with a
            heuristic, but A*’s OPEN/CLOSED lists must live in memory — the active frontier at any moment
            is roughly the surface of a ball of radius d, and for d ≈ 20 that’s 10¹²+ nodes. Won’t fit.
          </p>
          <p>
            <strong>IDA* (Iterative Deepening A*)</strong> trades memory for redundant work: run A*
            depth-first with no OPEN/CLOSED, just a recursion stack. Space drops from O(b<sup>d</sup>) to
            O(d). Each subtree gets re-expanded log-many times, but for cube-shaped problems (b ≈ 13,
            d ≤ 20) this trade is overwhelmingly worth it.
          </p>
        </>
      ),
    },
  },
  {
    num: '02',
    zh: {
      title: <>核心循环 — 迭代加深</>,
      body: (
        <>
          <p>
            IDA* 不预设深度,而是从一个<strong>初始阈值</strong> h(start) 出发,做受限 DFS:
            只展开满足 g + h ≤ <code>bound</code> 的节点。如果当前 bound 没找到解,
            把 bound 抬高到 DFS 期间遇到的"最小溢出 f 值",再来一遍。每轮搜索空间严格变大,直到找到解为止。
          </p>
          <pre className="algo-code">{`function idaStar(start: State): Move[] | null {
  let bound = h(start);
  while (true) {
    const t = search(start, [], 0, bound);
    if (t === FOUND) return solution;
    if (t === Infinity) return null;   // 无解
    bound = t;                          // 下一轮门槛 = 这轮最小溢出 f
  }
}

function search(node: State, path: Move[], g: number, bound: number): number {
  const f = g + h(node);
  if (f > bound) return f;              // 剪掉:下一轮再考虑
  if (isGoal(node)) { solution = path; return FOUND; }
  let min = Infinity;
  for (const m of moves(node, path)) {  // 含 move pruning
    const child = apply(node, m);
    path.push(m);
    const t = search(child, path, g + 1, bound);
    if (t === FOUND) return FOUND;
    if (t < min) min = t;
    path.pop();
  }
  return min;
}`}</pre>
          <p>
            两个不变量保证正确性:(1) 每轮 DFS 找出的解必然 ≤ bound;(2) bound 单调递增。
            只要 h 是 admissible 的 (≤ 真实距离),IDA* 找到的就是最优解。
          </p>
        </>
      ),
    },
    en: {
      title: <>The core loop — iterative deepening</>,
      body: (
        <>
          <p>
            IDA* doesn’t commit to a depth limit. Start with <code>bound = h(start)</code>; do a
            bounded DFS that expands only nodes with <code>g + h ≤ bound</code>. If nothing is found,
            raise <code>bound</code> to the smallest f-value that overflowed this round, and search again.
            Each round explores strictly more states than the previous one.
          </p>
          <pre className="algo-code">{`function idaStar(start: State): Move[] | null {
  let bound = h(start);
  while (true) {
    const t = search(start, [], 0, bound);
    if (t === FOUND) return solution;
    if (t === Infinity) return null;   // unsolvable
    bound = t;                          // next round = smallest overflow f
  }
}

function search(node: State, path: Move[], g: number, bound: number): number {
  const f = g + h(node);
  if (f > bound) return f;              // prune; revisit next round
  if (isGoal(node)) { solution = path; return FOUND; }
  let min = Infinity;
  for (const m of moves(node, path)) {  // includes move pruning
    const child = apply(node, m);
    path.push(m);
    const t = search(child, path, g + 1, bound);
    if (t === FOUND) return FOUND;
    if (t < min) min = t;
    path.pop();
  }
  return min;
}`}</pre>
          <p>
            Two invariants give correctness: (1) any solution found in a round has length ≤ bound;
            (2) bound is monotonically increasing. If h is admissible (≤ true distance), IDA* finds
            the optimum.
          </p>
        </>
      ),
    },
  },
  {
    num: '03',
    zh: {
      title: <>启发式 — admissible & consistent</>,
      body: (
        <>
          <p>
            搜索质量完全取决于启发式 h。两个性质要分清楚:
          </p>
          <ul>
            <li><strong>Admissible (可接受)</strong>:h(n) ≤ d*(n),即估计永不高估。这是最优性保证的底线。</li>
            <li><strong>Consistent (一致 / 单调)</strong>:对任意邻居 n', h(n) ≤ 1 + h(n'),即三角不等式。
              更强的条件,在 A* 里允许 CLOSED 不重开;在 IDA* 里允许跳过对 g + h 的某些重判。</li>
          </ul>
          <p>
            魔方语境下,所有"距离到 solved 的下界估计"都自动 admissible。常见构造:
            统计某个<strong>子状态</strong>(部分块或部分坐标)到归位的真实最短步数,
            预计算成查表 —— 这就是<strong>剪枝表 / 模式数据库 (Pattern Database)</strong>。
          </p>
          <p>
            子状态选得越大,h 越紧 (越接近真实距离),剪枝越狠;但表也越大。
            实践上是几张<strong>互不相交</strong>的小表取 <code>max</code> —— 仍然 admissible,
            又用了组合下界。
          </p>
        </>
      ),
    },
    en: {
      title: <>Heuristics — admissible & consistent</>,
      body: (
        <>
          <p>Search quality is entirely about h. Two properties to keep straight:</p>
          <ul>
            <li><strong>Admissible</strong>: h(n) ≤ d*(n) — never overestimates. Required for optimality.</li>
            <li><strong>Consistent / monotone</strong>: h(n) ≤ 1 + h(n') for any neighbor n' — the
              triangle inequality. Stronger than admissibility; lets A* skip re-opening CLOSED nodes,
              and lets IDA* drop some redundant g+h checks.</li>
          </ul>
          <p>
            For the cube, any lower bound on distance-to-solved is automatically admissible. The
            canonical construction: pick a <strong>sub-state</strong> (a subset of cubies or a coordinate),
            precompute the optimal distance from every value of that sub-state to its solved value, and
            store it as a lookup table — the <strong>pattern database</strong> (or "prune table").
          </p>
          <p>
            Bigger sub-states give tighter h and harsher pruning, but bigger tables. The practical
            recipe: take <code>max</code> over a handful of <strong>disjoint</strong> small tables —
            still admissible, plus a combined lower bound.
          </p>
        </>
      ),
    },
  },
  {
    num: '04',
    zh: {
      title: <>剪枝表 — Pattern Database</>,
      body: (
        <>
          <p>
            把"子状态 s → 到归位最短距离"做成一张数组 <code>prune[s]</code>,
            搜索时 O(1) 查表。这是 IDA* 在魔方上的灵魂。
          </p>
          <p>
            Kociemba phase 1 的典型构造:取 (corner-orient, UD-slice) 这个二元子状态,
            空间 = 3⁷ × C(12,4) = 2187 × 495 = 1,082,565。每个值存一个距离整数,1MB 量级。
            phase 1 的 IDA* 就用 <code>max(corner_prune, edge_prune, slice_prune)</code> 当 h。
          </p>
          <p>
            自研的 CFOP std solver 走更激进的路线:每个 CFOP 阶段都有自己的剪枝表,
            而且 F2L 多槽位<strong>共用</strong>一份表(通过共轭变换把 4 个槽位映射到同一个标准槽位 —— 详见
            <Link href="/code/algorithms/cfop-std-solver">CFOP 多阶段求解器</Link>)。
          </p>
        </>
      ),
    },
    en: {
      title: <>Pattern databases</>,
      body: (
        <>
          <p>
            Materialize "sub-state s → optimal distance to solved" as an array <code>prune[s]</code>;
            O(1) lookups during search. This is the heart of IDA* on the cube.
          </p>
          <p>
            Kociemba phase 1 uses the (corner-orient, UD-slice) pair as a sub-state: space =
            3⁷ × C(12,4) = 2187 × 495 = 1,082,565. Stored as one integer per entry, ~1 MB. The phase-1
            IDA* takes <code>max(corner_prune, edge_prune, slice_prune)</code> as h.
          </p>
          <p>
            CubeRoot’s own CFOP std solver is more aggressive: every CFOP stage owns a prune table, and
            all four F2L slots <strong>share</strong> one table by mapping each slot to a canonical one
            via conjugation — see the{' '}
            <Link href="/code/algorithms/cfop-std-solver">CFOP multi-stage solver</Link> page.
          </p>
        </>
      ),
    },
  },
  {
    num: '05',
    zh: {
      title: <>4-bit 紧凑存储</>,
      body: (
        <>
          <p>
            剪枝表的距离值通常 ≤ 14 (魔方各子状态的"直径"都不大),所以单个 entry 4 bit 就够。
            把两个 entry 塞进一字节,表的体积直接砍半。
          </p>
          <pre className="algo-code">{`function packed(idx: number): number {
  const byte = table[idx >>> 1];
  return (idx & 1) ? (byte & 0x0F) : (byte >>> 4);
}

function setPacked(idx: number, val: number): void {
  const i = idx >>> 1;
  if (idx & 1) table[i] = (table[i] & 0xF0) | (val & 0x0F);
  else         table[i] = (table[i] & 0x0F) | ((val & 0x0F) << 4);
}`}</pre>
          <p>
            上限 14 也很少卡到 —— 真正塞不下时还有更省的"<strong>距离 mod 3</strong>"trick:
            只存 (d mod 3) 用 2 bit,搜索时用邻居反推真实距离(d(n) = d(n') ± 1,
            知道 mod 3 就能定唯一)。能把表再砍半,但访存逻辑稍麻烦。
          </p>
        </>
      ),
    },
    en: {
      title: <>4-bit packed storage</>,
      body: (
        <>
          <p>
            Distances in a cube prune table are typically ≤ 14 (each sub-state diameter is small), so
            4 bits per entry is plenty. Two entries per byte halves the table footprint.
          </p>
          <pre className="algo-code">{`function packed(idx: number): number {
  const byte = table[idx >>> 1];
  return (idx & 1) ? (byte & 0x0F) : (byte >>> 4);
}

function setPacked(idx: number, val: number): void {
  const i = idx >>> 1;
  if (idx & 1) table[i] = (table[i] & 0xF0) | (val & 0x0F);
  else         table[i] = (table[i] & 0x0F) | ((val & 0x0F) << 4);
}`}</pre>
          <p>
            14 isn’t a tight ceiling in practice. When you do want to shrink further: the{' '}
            <strong>distance-mod-3</strong> trick stores just (d mod 3) in 2 bits and recovers the true
            distance from a neighbor (d(n) = d(n') ± 1; mod-3 disambiguates). Cuts the table again at
            the cost of one extra lookup per access.
          </p>
        </>
      ),
    },
  },
  {
    num: '06',
    zh: {
      title: <>逆向 BFS 填表</>,
      body: (
        <>
          <p>
            剪枝表的"距离值"必须是真实最短距离。直接从每个 state 跑 BFS 太慢 (N 次 BFS, N 是表大小)。
            标准做法:<strong>一次</strong> BFS,从<strong>归位状态出发,反向</strong>展开,逐层标距离。
            对每个未标记的邻居写入 d = 当前层 + 1,直到全部 entry 都被覆盖。
          </p>
          <pre className="algo-code">{`function buildPruneTable(N: number): Uint8Array {
  const table = new Uint8Array(N).fill(0xFF);
  table[encode(SOLVED)] = 0;
  let depth = 0, filled = 1;
  while (filled < N) {
    for (let s = 0; s < N; s++) {
      if (table[s] !== depth) continue;
      for (const m of MOVES) {
        const t = encode(apply(decode(s), m));
        if (table[t] === 0xFF) {
          table[t] = depth + 1;
          filled++;
        }
      }
    }
    depth++;
  }
  return table;
}`}</pre>
          <p>
            注意是从 solved 出发,因为<strong>所有转动都是双射可逆</strong>,正向距离 = 反向距离。
            实际工程里上面的循环不会真的 O(N²) 扫每层,会用一个 frontier 数组按层推进。
          </p>
        </>
      ),
    },
    en: {
      title: <>Reverse BFS to fill the table</>,
      body: (
        <>
          <p>
            Entries must hold true shortest distances. Running BFS from each state would be O(N) BFSes.
            The trick: run <strong>one</strong> BFS, starting from the solved state and walking{' '}
            <strong>outwards</strong>. Each newly discovered state gets <code>d = current_depth + 1</code>.
          </p>
          <pre className="algo-code">{`function buildPruneTable(N: number): Uint8Array {
  const table = new Uint8Array(N).fill(0xFF);
  table[encode(SOLVED)] = 0;
  let depth = 0, filled = 1;
  while (filled < N) {
    for (let s = 0; s < N; s++) {
      if (table[s] !== depth) continue;
      for (const m of MOVES) {
        const t = encode(apply(decode(s), m));
        if (table[t] === 0xFF) {
          table[t] = depth + 1;
          filled++;
        }
      }
    }
    depth++;
  }
  return table;
}`}</pre>
          <p>
            "From solved" works because every cube move is a bijection — forward and backward distances
            are equal. Real implementations don’t re-scan all N each level; they keep a frontier list and
            advance it.
          </p>
        </>
      ),
    },
  },
  {
    num: '07',
    zh: {
      title: <>移动剪枝 (Move pruning)</>,
      body: (
        <>
          <p>
            实际分支因子远小于 18。两条规则就能把它压到 ~13:
          </p>
          <ul>
            <li><strong>同面不连续</strong>:刚转过 U,就别再转 U / U' / U²。这一面所有可能结果已经包括在上一步,
              连续转就是绕弯路。</li>
            <li><strong>同轴反序</strong>:U 和 D 互不影响(转的是不同面),
              连续转 U-D 跟连续转 D-U 等价。规定一个固定序就够,反过来直接剪掉。</li>
          </ul>
          <p>
            实现上,在 <code>moves(node, path)</code> 里看上一步是什么面,过滤掉冲突候选。
            分支因子从 18 砍到大约 13.34,看着不多,但 <code>13<sup>20</sup> / 18<sup>20</sup></code>
            差出 10⁵ 倍。
          </p>
        </>
      ),
    },
    en: {
      title: <>Move pruning</>,
      body: (
        <>
          <p>Real branching factor is well below 18. Two rules push it to ~13:</p>
          <ul>
            <li><strong>No consecutive same-face moves</strong>: after U, never U / U' / U². All
              same-face combinations are already enumerated as a single move.</li>
            <li><strong>Canonical order for same-axis pairs</strong>: U and D commute. Allow only one of
              the orderings (say, U before D) and prune the reverse.</li>
          </ul>
          <p>
            Implementation: <code>moves(node, path)</code> peeks at the previous face and filters.
            Effective branching factor drops from 18 to about 13.34 — not dramatic per step, but the
            ratio <code>13<sup>20</sup> / 18<sup>20</sup></code> is ~10⁵.
          </p>
        </>
      ),
    },
  },
  {
    num: '08',
    zh: {
      title: <>对称归一化</>,
      body: (
        <>
          <p>
            魔方有 48 个对称(24 个旋转 × 2 个镜像)。某个状态 s 和它的 48 个对称像 σ(s) 解长相同,
            剪枝表完全可以只存"等价类代表"。表大小直接除以 ~48(实际去掉 stabilizer 后是 16 左右)。
          </p>
          <p>
            min2phase 把这种"对称压缩"做到了极致 —— Huge prune (CornUDSliceFlip / CornEdg)
            没有对称压缩根本装不进内存。代价是查表时需要先做"对称归一化": 把当前 cube 状态映射到
            canonical 形态,再查表。
          </p>
          <p>
            想看完整对称压缩实现 → <Link href="/code/algorithms/min2phase">min2phase</Link>。
          </p>
        </>
      ),
    },
    en: {
      title: <>Symmetry reduction</>,
      body: (
        <>
          <p>
            The cube has 48 symmetries (24 rotations × 2 reflections). A state s and any image σ(s)
            have identical optimal solve lengths, so a prune table can store only one representative
            per equivalence class. Size shrinks by ~48× (closer to 16× after accounting for stabilizers).
          </p>
          <p>
            min2phase pushes this to the limit — its huge tables (CornUDSliceFlip / CornEdg) wouldn’t
            fit in memory without it. The cost: each lookup needs symmetry normalization first,
            mapping the live state to its canonical form.
          </p>
          <p>
            For a full symmetry-compressed implementation see{' '}
            <Link href="/code/algorithms/min2phase">min2phase</Link>.
          </p>
        </>
      ),
    },
  },
  {
    num: '09',
    zh: {
      title: <>性能直觉</>,
      body: (
        <>
          <p>
            一次 IDA* 求解的耗时大致由三个因素决定:
          </p>
          <ul>
            <li><strong>h 的紧度</strong> — h 越接近 d*,剪枝越早。紧度从 0.5 提到 0.8 通常带来 10× 速度。</li>
            <li><strong>分支因子</strong> — 同 d,b 从 18 降到 13 是 (13/18)<sup>d</sup> 的成本压缩。</li>
            <li><strong>表访问局部性</strong> — 剪枝表频繁访问,装下到 L2 cache 比 L3 快几倍。
              这是为什么 4-bit pack / mod-3 trick 不只是省空间,也是提速。</li>
          </ul>
          <table className="algo-table">
            <thead>
              <tr>
                <th><L zh="应用" en="Application" /></th>
                <th><L zh="剪枝表" en="Prune tables" /></th>
                <th className="num"><L zh="典型耗时" en="Typical cost" /></th>
                <th><L zh="链接" en="Page" /></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Kociemba phase 1</td>
                <td><L zh="CO × UDslice / EO × UDslice (~1MB 每张)" en="CO×UDslice / EO×UDslice (~1MB each)" /></td>
                <td className="num">~10ms</td>
                <td><Link href="/code/algorithms/kociemba">Kociemba</Link></td>
              </tr>
              <tr>
                <td>min2phase</td>
                <td><L zh="Huge sym-compressed (~30MB)" en="Huge sym-compressed (~30MB)" /></td>
                <td className="num"><L zh="< 5ms 平均" en="< 5ms avg" /></td>
                <td><Link href="/code/algorithms/min2phase">min2phase</Link></td>
              </tr>
              <tr>
                <td><L zh="CFOP std solver / 单阶段" en="CFOP std solver / per stage" /></td>
                <td><L zh="F2L 槽共用 (Lehmer + 共轭)" en="F2L slot-shared (Lehmer + conjugation)" /></td>
                <td className="num">~1–50ms</td>
                <td><Link href="/code/algorithms/cfop-std-solver">CFOP std</Link></td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    },
    en: {
      title: <>Performance intuition</>,
      body: (
        <>
          <p>One IDA* solve runs are roughly bound by three things:</p>
          <ul>
            <li><strong>How tight h is</strong> — closer to d*, earlier the prune. Going from 0.5 to
              0.8 tightness typically buys ~10× speed.</li>
            <li><strong>Branching factor</strong> — at the same d, going from b=18 to b=13 cuts cost
              by (13/18)<sup>d</sup>.</li>
            <li><strong>Table access locality</strong> — prune tables get hammered. Fitting in L2 vs L3
              is a few × difference. That’s why 4-bit packing / mod-3 isn’t just space, it’s speed.</li>
          </ul>
        </>
      ),
    },
  },
  {
    num: '10',
    zh: {
      title: <>本站三处用到 IDA*</>,
      body: (
        <>
          <p>
            CubeRoot 站内三类求解器都建在 IDA* 之上:
          </p>
          <ol>
            <li><Link href="/code/algorithms/kociemba">Kociemba 二阶段</Link> — phase 1 / phase 2 各自一次 IDA*,
              三张子状态剪枝表取 max 当 h。</li>
            <li><Link href="/code/algorithms/min2phase">min2phase</Link> — phase 1 和 phase 2 交错搜索,
              对称压缩的 huge prune 当 h,几毫秒出解。</li>
            <li><Link href="/code/algorithms/cfop-std-solver">CFOP std solver</Link> — 5 个 CFOP 阶段
              各跑一次 IDA*,F2L 槽位用共轭变换共用剪枝表,5 阶段间下界传播。</li>
          </ol>
          <p>
            模板都一样,差别在<strong>用什么子状态做剪枝表 / 怎么压缩这张表 / 阶段怎么衔接</strong>。
          </p>
        </>
      ),
    },
    en: {
      title: <>Where it shows up on this site</>,
      body: (
        <>
          <p>Three families of solver on CubeRoot all sit on IDA*:</p>
          <ol>
            <li><Link href="/code/algorithms/kociemba">Kociemba two-phase</Link> — one IDA* per phase;
              the max of three sub-state prune tables is h.</li>
            <li><Link href="/code/algorithms/min2phase">min2phase</Link> — phases interleaved; huge
              symmetry-compressed prune tables; sub-millisecond per solve in steady state.</li>
            <li><Link href="/code/algorithms/cfop-std-solver">CFOP std solver</Link> — one IDA* per CFOP
              stage; F2L slots share prune tables via conjugation; cross-stage lower-bound propagation.</li>
          </ol>
          <p>
            Same template, different answers to: <strong>which sub-state for the prune table, how to
            compress it, how to glue the stages together.</strong>
          </p>
        </>
      ),
    },
  },
];

export default function IdaStarPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useDocumentTitle('IDA* + 剪枝表', 'IDA* + prune tables');

  return (
    <LangCtx.Provider value={lang}>
      <div className="algo-page" style={{ ['--accent' as string]: ACCENT }}>
        <div className="algo-page-bg" />
        <div className="algo-page-inner">
          <div className="algo-page-topbar">
            <Link href="/code/algorithms" className="algo-page-back">← /code/algorithms</Link>
          </div>

          <header className="algo-page-head">
            <div className="algo-page-tag">
              <L zh="通用底座" en="Foundation" />
            </div>
            <h1 className="algo-page-title">IDA* + prune tables</h1>
            <p className="algo-page-sub">
              <L
                zh={<>所有魔方求解器共用的搜索底座:迭代加深 A* 配 admissible 启发式;状态距离用逆向 BFS 预计算压成 4-bit 查表。本页拆开讲每一步在做什么 —— 站内的 Kociemba / min2phase / CFOP 多阶段三种实现全都建在它上面。</>}
                en={<>The search engine every cube solver shares: iterative deepening A* with an admissible heuristic. State distance is pre-computed by reverse BFS into a 4-bit lookup table. This page unpacks each piece — the site’s Kociemba / min2phase / CFOP-multi-stage solvers all sit on this.</>}
              />
            </p>
          </header>

          <div className="algo-callout">
            <div className="algo-callout-tag">{lang === 'zh' ? '为何要看这页' : 'Why this page'}</div>
            <p>
              <L
                zh={<>看完之后,你应该能读懂 <Link href="/code/algorithms/kociemba">Kociemba</Link>、<Link href="/code/algorithms/min2phase">min2phase</Link>、<Link href="/code/algorithms/cfop-std-solver">CFOP std solver</Link> 三张姐妹页里所有"剪枝表 / admissible h / 4-bit pack"之类术语,而不需要再回头解释。</>}
                en={<>By the end you should be able to read <Link href="/code/algorithms/kociemba">Kociemba</Link>, <Link href="/code/algorithms/min2phase">min2phase</Link>, and <Link href="/code/algorithms/cfop-std-solver">CFOP std solver</Link> without us re-defining "prune table / admissible h / 4-bit pack" anywhere.</>}
              />
            </p>
          </div>

          {SECTIONS.map((s) => {
            const t = lang === 'zh' ? s.zh : s.en;
            return (
              <section key={s.num} className="algo-section">
                <div className="algo-section-head">
                  <span className="algo-section-num">{s.num}</span>
                  <h2 className="algo-section-title">{t.title}</h2>
                </div>
                {t.body}
              </section>
            );
          })}

          <footer className="algo-page-foot">
            <Link href="/">CubeRoot</Link> · <Link href="/code/algorithms">/code/algorithms</Link>
          </footer>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
