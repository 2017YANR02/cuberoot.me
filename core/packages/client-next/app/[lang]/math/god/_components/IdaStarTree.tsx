'use client';

/**
 * IDA* + Pattern Database 可视化:
 *
 * 一棵深度 d_max 的搜索树。每个节点是一个状态(用一个伪 cube state 编号代替)。
 *   - 每条边代表一次合法转动(去同轴后)
 *   - 节点上显示 g(累积深度)+ h(PDB 启发)+ f = g + h
 *   - 当 f > limit 时,该子树被剪枝(显示成虚线 + 灰)
 *   - 当 state == identity 时,该叶节点为 solution
 *
 * 用户可:
 *   1. 拖滑块改 f-limit(IDA* iterative deepening 的当前阈值)
 *   2. 切换三种启发:无 (h=0, naive BFS) / corner-only PDB / corner + 6-edge PDB
 *   3. hover 节点看 (g, h, f) 三元组
 *
 * 树用一个固定 mock 数据集(每节点的 h 值预生成),保证视觉稳定 + 教学清晰。
 */
import { useMemo, useState } from 'react';
import { TeX, MathText } from './Tex';
import i18n from '@/i18n/i18n-client';

type HeurMode = 'none' | 'corners' | 'corners-edges';

interface Node {
  id: number;
  parent: number;
  depth: number;          // = g
  /** 三种启发下的 h 值。0 = identity (solved). */
  hNone: number;          // = 0 if identity, else 1 (admissible trivial)
  hCorners: number;       // corner-PDB lookup
  hCornersEdges: number;  // corner + 6-edge PDB lookup
  /** move applied from parent (display only) */
  move: string;
  /** child ids */
  children: number[];
  /** is this a solved leaf? (identity reached) */
  solved: boolean;
}

/** Generate a mock IDA* search tree for visualization.
 *
 * We seed a state with "true distance" = 8 from identity, branching factor 6
 * (after same-axis pruning). Each node has:
 *   true_d = 8 - depth + noise  (rough decreasing function of depth)
 *   hCorners       = max(0, true_d - 2)  // less informed
 *   hCornersEdges  = max(0, true_d - 0)  // better informed
 * One designated "solution path" reaches identity at depth 8.
 */
function buildTree(): Node[] {
  const tree: Node[] = [];
  let nextId = 0;
  const TRUE_D = 8;        // root true distance from identity
  const SOL_PATH_BRANCH = [0, 1, 0, 1, 0, 1, 0, 1]; // pick child idx along path
  const BFAC = 3;          // branching factor in visualisation
  const MAX_DEPTH = 8;

  function spawn(parentId: number, depth: number, onSolPath: boolean) {
    if (depth > MAX_DEPTH) return;
    const id = nextId++;
    const trueD = onSolPath ? (TRUE_D - depth) : Math.max(TRUE_D - depth + 1 + (id % 3), 1);
    const solved = onSolPath && depth === TRUE_D;
    const moves = ['R', 'U', "R'", 'F', 'L', "U'"];
    const node: Node = {
      id,
      parent: parentId,
      depth,
      hNone: solved ? 0 : 1,
      hCorners: solved ? 0 : Math.max(0, trueD - 2 + ((id % 5) === 0 ? 1 : 0)),
      hCornersEdges: solved ? 0 : Math.max(0, trueD),
      move: parentId === -1 ? '' : moves[(id) % moves.length],
      children: [],
      solved,
    };
    tree.push(node);
    if (solved) return;
    if (depth === MAX_DEPTH) return;
    for (let i = 0; i < BFAC; i++) {
      const childOnSolPath = onSolPath && i === SOL_PATH_BRANCH[depth];
      const childId = nextId; // peek
      spawn(id, depth + 1, childOnSolPath);
      node.children.push(childId);
    }
  }

  spawn(-1, 0, true);
  return tree;
}

const TREE = buildTree();

const NODES_BY_ID = new Map(TREE.map((n) => [n.id, n]));

/** Lay out the tree: each node gets (x, y) based on subtree breadth. */
function layout(): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  const W = 720;
  const H_PER_DEPTH = 56;

  // Number of leaves in each subtree (only used for x positioning)
  const subSize: Map<number, number> = new Map();
  function size(id: number): number {
    if (subSize.has(id)) return subSize.get(id)!;
    const n = NODES_BY_ID.get(id)!;
    if (n.children.length === 0) { subSize.set(id, 1); return 1; }
    let s = 0;
    for (const c of n.children) s += size(c);
    subSize.set(id, s);
    return s;
  }
  const root = TREE[0];
  size(root.id);

  function place(id: number, xLeft: number, xRight: number) {
    const n = NODES_BY_ID.get(id)!;
    const x = (xLeft + xRight) / 2;
    const y = 30 + n.depth * H_PER_DEPTH;
    out.set(id, { x, y });
    if (n.children.length === 0) return;
    const total = size(id);
    let cursor = xLeft;
    for (const c of n.children) {
      const w = (size(c) / total) * (xRight - xLeft);
      place(c, cursor, cursor + w);
      cursor += w;
    }
  }
  place(root.id, 24, W - 24);
  return out;
}

const LAYOUT = layout();

interface Props { isZh: boolean; }

export default function IdaStarTree({ isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [mode, setMode] = useState<HeurMode>('corners-edges');
  const [limit, setLimit] = useState(8);
  const [hover, setHover] = useState<number | null>(null);

  const hOf = (n: Node) =>
    mode === 'none' ? n.hNone : mode === 'corners' ? n.hCorners : n.hCornersEdges;

  /** Walk tree top-down; a node is "live" iff parent is live and f ≤ limit. */
  const live = useMemo(() => {
    const set = new Set<number>();
    function walk(id: number, parentLive: boolean) {
      const n = NODES_BY_ID.get(id)!;
      const f = n.depth + hOf(n);
      const me = parentLive && f <= limit;
      if (me) set.add(id);
      for (const c of n.children) walk(c, me);
    }
    walk(TREE[0].id, true);
    return set;
  }, [mode, limit]);

  const counts = useMemo(() => {
    let total = 0, visited = 0, pruned = 0, solutions = 0;
    for (const n of TREE) {
      total++;
      const f = n.depth + hOf(n);
      const parentLive = n.parent === -1 ? true : live.has(n.parent);
      if (parentLive && f <= limit) {
        visited++;
        if (n.solved) solutions++;
      } else if (parentLive && f > limit) {
        pruned++;
      }
    }
    return { total, visited, pruned, solutions };
  }, [mode, limit, live]);

  const heurDesc: Record<HeurMode, { zh: string; en: string
          zhHant?: string;
 }> = {
    none: {
      zh: 'h(s) ≡ 1: 没有 PDB,等价于 iterative deepening DFS。f-limit 必须扫遍每个节点,完全无剪枝。',
      en: 'h(s) ≡ 1: no PDB, equivalent to iterative deepening DFS. The f-limit scans every node, zero pruning.',
        zhHant: "h(s) ≡ 1: 沒有 PDB,等價於 iterative deepening DFS。f-limit 必須掃遍每個節點,完全無剪枝。"
    },
    corners: {
      zh: 'h(s) = 角块 PDB 查表: 预计算"只看 8 个角块"在 G₃ = ⟨180°⟩ 内的最优距离。占 88 MB,提示稍弱(角朝向 + 角排列 = 8!·3⁷ ≈ 8.8 × 10⁷ 种)。',
      en: 'h(s) = corner-only PDB lookup: precompute the optimal distance restricted to the 8 corners (in G₃ = ⟨180°⟩). 88 MB on disk, mildly informed (8!·3⁷ ≈ 8.8 × 10⁷ entries).',
        zhHant: "h(s) = 角塊 PDB 查表: 預計算\"只看 8 個角塊\"在 G₃ = ⟨180°⟩ 內的最優距離。佔 88 MB,提示稍弱(角朝向 + 角排列 = 8!·3⁷ ≈ 8.8 × 10⁷ 種)。"
    },
    'corners-edges': {
      zh: 'h(s) = max(角 PDB, 6-edge PDB): Korf 1997 的经典启发,8.8 × 10⁷ 角条目 + 2 个 6-edge 子集表(各 4.2 × 10⁸,共 ~1.5 GB)。三阶 IDA* 实际用的就是这个,平均剪掉 99.9% 节点。',
      en: 'h(s) = max(corner PDB, 6-edge PDBs): Korf\'s classic 1997 heuristic. 8.8 × 10⁷ corner entries + two 6-edge subset tables (4.2 × 10⁸ each, ~1.5 GB total). The real-world 3×3 IDA*; prunes ~99.9% of nodes.',
        zhHant: "h(s) = max(角 PDB, 6-edge PDB): Korf 1997 的經典啟發,8.8 × 10⁷ 角條目 + 2 個 6-edge 子集表(各 4.2 × 10⁸,共 ~1.5 GB)。三階 IDA* 實際用的就是這個,平均剪掉 99.9% 節點。"
    },
  };

  return (
    <div className="god-ida-wrap">
      {/* heuristic mode */}
      <div className="god-ida-controls">
        <div className="god-ida-segctl">
          <span className="god-ida-segctl-l">{t('启发函数 h(s):', 'Heuristic h(s):', "啟發函式 h(s):")}</span>
          {(['none', 'corners', 'corners-edges'] as HeurMode[]).map((m) => (
            <button key={m}
                    className={`god-metric-tab ${mode === m ? 'is-on' : ''}`}
                    onClick={() => setMode(m)}>
              {m === 'none' ? t('无 (BFS)', 'none (BFS)', "無 (BFS)") :
               m === 'corners' ? t('8 角 PDB', '8-corner PDB') :
                                  t('Korf (角 + 6 棱)', 'Korf (corners + 6 edges)', "Korf (角 + 6 稜)")}
            </button>
          ))}
        </div>
        <div className="god-ida-segctl">
          <label className="god-ida-segctl-l" htmlFor="ida-limit">
            {t('f-阈值', 'f-limit', "f-閾值")}: <b style={{ color: 'var(--god-accent)' }}>{limit}</b>
          </label>
          <input id="ida-limit" type="range" min={0} max={10} step={1}
                 value={limit} onChange={(e) => setLimit(+e.target.value)}
                 className="god-ida-slider" />
        </div>
      </div>

      <p className="god-ida-heur-desc">
        <MathText>{(i18n.language === 'zh-Hant' ? (heurDesc[mode].zhHant ?? heurDesc[mode].zh) : (i18n.language.startsWith('zh') ? heurDesc[mode].zh : heurDesc[mode].en))}</MathText>
      </p>

      {/* counts */}
      <div className="god-ida-counts">
        <div><span className="l">{t('节点总数', 'Total nodes', "節點總數")}</span><b>{counts.total}</b></div>
        <div><span className="l">{t('已访问', 'Visited', "已訪問")}</span><b style={{ color: 'var(--god-accent)' }}>{counts.visited}</b></div>
        <div><span className="l">{t('被剪枝', 'Pruned')}</span><b style={{ color: 'var(--god-warn)' }}>{counts.pruned}</b></div>
        <div><span className="l">{t('解 (识别 d=8)', 'Solutions found', "解 (識別 d=8)")}</span><b style={{ color: 'var(--god-wca)' }}>{counts.solutions}</b></div>
        <div><span className="l">{t('剪枝率', 'Prune rate')}</span><b>{((counts.pruned / Math.max(1, counts.visited + counts.pruned)) * 100).toFixed(0)}%</b></div>
      </div>

      {/* tree */}
      <svg viewBox="0 0 720 540" className="god-ida-svg" preserveAspectRatio="xMidYMid meet"
           role="img" aria-label={t('IDA* 搜索树', 'IDA* search tree', "IDA* 搜尋樹")}>
        {/* edges */}
        {TREE.filter((n) => n.parent !== -1).map((n) => {
          const a = LAYOUT.get(n.parent)!;
          const b = LAYOUT.get(n.id)!;
          const isLive = live.has(n.id);
          return (
            <line key={`e-${n.id}`}
                  x1={a.x} y1={a.y + 9} x2={b.x} y2={b.y - 9}
                  stroke={isLive ? 'var(--god-text-mute)' : 'var(--god-border)'}
                  strokeWidth={isLive ? 1.2 : 1}
                  strokeDasharray={isLive ? '0' : '3 3'}
                  opacity={isLive ? 0.7 : 0.4} />
          );
        })}
        {/* nodes */}
        {TREE.map((n) => {
          const p = LAYOUT.get(n.id)!;
          const h = hOf(n);
          const f = n.depth + h;
          const isLive = live.has(n.id);
          const isHover = hover === n.id;
          const color = n.solved ? 'var(--god-wca)' :
                        !isLive ? 'var(--god-text-mute)' :
                        f === limit ? 'var(--god-warn)' :
                        'var(--god-accent)';
          return (
            <g key={n.id}
               onMouseEnter={() => setHover(n.id)}
               onMouseLeave={() => setHover(null)}
               style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r={n.solved ? 11 : 8}
                      fill={isLive ? color : 'var(--god-surface)'}
                      stroke={color}
                      strokeWidth={n.solved ? 2.5 : 1.5}
                      opacity={isLive ? 1 : 0.4} />
              {/* g + h labels */}
              {(isLive || isHover) && (
                <>
                  <text x={p.x} y={p.y + 2.5} fontSize="7.5"
                        textAnchor="middle"
                        fill={isLive ? 'var(--accent-foreground)' : 'var(--god-text-mute)'}
                        fontWeight="600">
                    {f}
                  </text>
                </>
              )}
              {/* move label on edge */}
              {n.move && (
                <text x={p.x + 8} y={p.y - 12} fontSize="8"
                      fill="var(--god-text-mute)" opacity={isLive ? 0.7 : 0.3}>
                  {n.move}
                </text>
              )}
            </g>
          );
        })}
        {/* solution path highlight */}
        {(() => {
          const solIds: number[] = [];
          for (const n of TREE) if (n.solved && live.has(n.id)) {
            let cur: number | undefined = n.id;
            while (cur != null && cur !== -1) {
              solIds.push(cur);
              const parentId: number = NODES_BY_ID.get(cur)!.parent;
              cur = parentId === -1 ? undefined : parentId;
            }
          }
          const paths: string[] = [];
          for (let i = 0; i < solIds.length - 1; i++) {
            const a = LAYOUT.get(solIds[i])!;
            const b = LAYOUT.get(solIds[i + 1])!;
            paths.push(`M${a.x},${a.y} L${b.x},${b.y}`);
          }
          return paths.length > 0 ? (
            <path d={paths.join(' ')} stroke="var(--god-wca)" strokeWidth="2.5" fill="none" opacity="0.5" />
          ) : null;
        })()}
        {/* depth axis labels */}
        {Array.from({ length: 9 }).map((_, d) => (
          <text key={d} x={8} y={30 + d * 56 + 3} fontSize="9" fill="var(--god-text-mute)">
            d={d}
          </text>
        ))}
      </svg>

      {/* hover readout */}
      <div className="god-ida-readout">
        {hover != null ? (() => {
          const n = NODES_BY_ID.get(hover)!;
          const h = hOf(n);
          const f = n.depth + h;
          const isLive = live.has(n.id);
          return (
            <>
              <strong>{t('节点', 'Node', "節點")} #{n.id}:</strong>{' '}
              <TeX src={`g = ${n.depth}`} />{' · '}
              <TeX src={`h = ${h}`} />{' · '}
              <TeX src={`f = g + h = ${f}`} />{' · '}
              {n.solved ? <span style={{ color: 'var(--god-wca)' }}>{t('✓ 解', '✓ solution')}</span> :
               isLive ? <span style={{ color: 'var(--god-accent)' }}>{t('已访问', 'expanded', "已訪問")}</span> :
                        <span style={{ color: 'var(--god-text-mute)' }}>{t('剪枝 (f > limit)', 'pruned (f > limit)')}</span>}
            </>
          );
        })() : (
          <span className="god-growth-hint">
            <MathText>{t(
              'hover 任意节点查 g/h/f。三阶完整解需要 g + h ≤ 20 的路径;启发 h 越紧,被剪枝的子树越多。Korf 启发把 21 步迭代的搜索从 10²⁰ 节点压到 10⁹ 量级。',
              'Hover any node for g/h/f. A real 3×3 needs g + h ≤ 20; tighter h means more pruning. Korf\'s heuristic shrinks a 21-iteration search from ~10²⁰ down to ~10⁹ nodes.', "hover 任意節點查 g/h/f。三階完整解需要 g + h ≤ 20 的路徑;啟發 h 越緊,被剪枝的子樹越多。Korf 啟發把 21 步迭代的搜尋從 10²⁰ 節點壓到 10⁹ 量級。"
            )}</MathText>
          </span>
        )}
      </div>

      <p className="god-ida-caption">
        <MathText>{t(
          '本树是 8 层、分支因子 3 的教学版 (共 ~3,280 节点);真实三阶 IDA* 分支因子 ~13.34 (去同轴),iteration 21 时节点数 ~ 13.34²¹ ≈ 4 × 10²³,无启发完全跑不动。Korf 1997 用 1.5 GB PDB 把节点压到 ~ 10⁸ 量级,毫秒级返回。本组件演示的是同一个剪枝机制,但缩放到肉眼可见。',
          'The tree above is a teaching-scale 8-layer branching-3 example (~3,280 nodes); a real 3×3 IDA* has branching ~13.34 (after same-axis pruning), so iteration 21 hits ~13.34²¹ ≈ 4 × 10²³ — utterly infeasible without heuristic. Korf\'s 1.5 GB PDB cuts that to ~10⁸ and returns in milliseconds. Same pruning mechanism, just scaled where the eye can follow.', "本樹是 8 層、分支因子 3 的教學版 (共 ~3,280 節點);真實三階 IDA* 分支因子 ~13.34 (去同軸),iteration 21 時節點數 ~ 13.34²¹ ≈ 4 × 10²³,無啟發完全跑不動。Korf 1997 用 1.5 GB PDB 把節點壓到 ~ 10⁸ 量級,毫秒級返回。本元件演示的是同一個剪枝機制,但縮放到肉眼可見。"
        )}</MathText>
      </p>
    </div>
  );
}
