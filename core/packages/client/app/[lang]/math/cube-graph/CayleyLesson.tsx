'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import { TeX } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import { CUBE3_STATES } from '@/lib/god-distance-333';

/** A complete four-state subgroup, separate from the free-play cube above. */
export default function CayleyLesson() {
  const t = useT();
  const [metric, setMetric] = useState<'htm' | 'qtm'>('qtm');
  const [steps, setSteps] = useState(0);
  const current = steps % 4;
  const distance = metric === 'htm' ? Number(current !== 0) : Math.min(current, 4 - current);
  const nodes = [{ x: 70, y: 45, label: 'e' }, { x: 290, y: 45, label: 'R' },
    { x: 290, y: 225, label: 'R²' }, { x: 70, y: 225, label: 'R′' }];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], ...(metric === 'htm' ? [[0, 2], [1, 3]] : [])];

  return <section id="cayley-bridge">
    <h2>{t('魔方与凯莱图：从贴纸走向整个状态', 'The cube and its Cayley graph: from stickers to whole states')}</h2>
    <p>{t('上面的圆环图回答“每枚贴纸去了哪里”，凯莱图回答“整个魔方变成了哪个状态”。一次 R 转动会同时移动 20 枚贴纸，却只让凯莱图中的当前位置跨过一条标为 R 的边。把这两个层次分清楚，才能理解魔方为什么是一个群，以及还原为什么可以看成找路。', 'The ring diagram answers “where did each sticker go?” A Cayley graph answers “which state is the whole cube in?” An R turn moves 20 stickers at once, yet takes the current cube state across just one edge labelled R. Distinguishing these levels explains both the cube group and solving as pathfinding.')}</p>

    <h3>{t('1. 一个点到底代表什么？', '1. What does one vertex represent?')}</h3>
    <dl>
      <dt><strong>{t('贴纸位置图：54 个位置', 'Sticker-position diagram: 54 positions')}</strong></dt>
      <dd>{t('每个位置容纳一枚贴纸；完整的颜色和贴纸编号分布才描述一个魔方状态。圆环、扇区只是坐标安排。若另行连接物理相邻的贴纸，得到的是贴纸相邻图，它的边表示接壤，不表示一次转动。', 'Each position holds one sticker; the full arrangement of colours and sticker identities describes a cube state. Rings and sectors are coordinate layouts. Connecting physically adjacent stickers would instead produce a sticker adjacency graph, whose edges mean adjacency, not moves.')}</dd>
      <dt><strong>{t('凯莱图：一个点就是一个完整状态', 'Cayley graph: one vertex is one complete state')}</strong></dt>
      <dd>{t('还原态是单位元 e。R、R U 等标签描述从还原态到达该点的一种走法；节点里隐含的是全部角块和棱块的位置与朝向。这里没有“54 个点拼成一个魔方”，而是“每个点都包含一个完整魔方”。', 'The solved state is the identity e. Labels such as R and R U give one way to reach a vertex from solved. A vertex contains all corner and edge positions and orientations. Instead of 54 points making one cube, every point represents a whole cube.')}</dd>
    </dl>

    <h3>{t('2. 为什么可以把状态当成群元素？', '2. Why can states be treated as group elements?')}</h3>
    <p>{t('固定六个中心定义的参考方向，只允许合法面转。每串转动都是贴纸位置上的一个置换；接着执行另一串转动就是合成，不转是单位元，倒序执行各步的逆转就是逆元。置换合成满足结合律，因此这些操作组成魔方群 G。以还原态为起点，每个这样的操作效果都唯一确定一个可达状态。', 'Fix a reference frame defined by the six centres and allow legal face turns. Every move sequence permutes sticker positions. Executing another sequence composes operations; doing nothing is the identity, and reversing the sequence while inverting each move gives its inverse. Composition is associative, so these operations form the cube group G. Starting from solved identifies each operation with its resulting reachable state.')}</p>
    <p>{t('状态数不是 54!：同一块上的贴纸不能拆开，角块扭转总和、棱块翻转总和以及角棱置换的奇偶性都受约束。普通三阶不区分中心贴纸自转方向，在固定中心参考系下有下面这么多种状态。', 'The count is not 54!: stickers belonging to one cubie stay together, and corner twists, edge flips and permutation parity are constrained. For an ordinary 3×3, ignoring centre-sticker orientation and using a fixed centre frame, the count is:')}</p>
    <p className="cube-graph-formula"><TeX src={String.raw`|G|=8!\,3^7\,12!\,2^{10}`} /></p>
    <p><strong>{BigInt(CUBE3_STATES).toLocaleString('en-US')}</strong>{t(' 个状态。8! 与 12! 排列角块和棱块；3⁷ 与 2¹¹ 计入允许的朝向；再除以 2，使角块和棱块置换的奇偶性一致。', ' states. The factorials arrange corners and edges; 3⁷ and 2¹¹ count allowed orientations; division by 2 enforces matching corner and edge permutation parity.')}</p>

    <h3>{t('3. 生成元就是允许走的边', '3. Generators specify the available edges')}</h3>
    <p>{t('选好允许的一步操作集合 S，就得到 Cay(G,S)。这里约定 gs 表示“先做到 g，再执行 s”，于是每个状态 g 都有一条标为 s、通向 gs 的有向边。R 的返回边标为 R′；若 S 包含每一步的逆，可以把一对反向边合成一条无向边。乘法写法取决于约定，但执行转动的顺序必须一致。', 'Choose a set S of allowed single moves to obtain Cay(G,S). Here gs means “reach g, then execute s”, giving a directed edge labelled s from g to gs. The return edge for R is labelled R′. If S contains every inverse, opposite edges may be paired into one undirected edge. Multiplication conventions can differ; the physical execution order must remain consistent.')}</p>
    <p>{t('HTM 中，每个面的 90°、180°、270° 都算一步，共 18 个邻居。QTM 中只有顺、逆 90° 算一步，共 12 个邻居，R2 必须走两步。两种图的顶点集合相同，但边和最短距离不同。中层、宽层、整体转体不属于这两个面转生成集；上方自由操作区允许这些动作，不能直接把输入记号数当作 HTM 或 QTM 距离。', 'In HTM, 90°, 180° and 270° face turns each count as one move, giving 18 neighbours. QTM has 12 neighbours from clockwise and counterclockwise quarter turns; R2 takes two steps. The vertex set is the same, but edges and distances differ. Slice moves, wide moves and whole-cube rotations are not generators in either of these face-turn sets. The free-play cube above accepts them, so its token count is not automatically an HTM or QTM distance.')}</p>

    <h3>{t('4. 先看得完整：只转 R 的四个状态', '4. A complete example: the four states generated by R')}</h3>
    <p>{t('下面是子群 ⟨R⟩ 的完整凯莱图，不是整个魔方群的缩略图。四个点分别代表不转、R、R2、R′ 后的完整魔方。每次“走 R”都顺着正方形走一格；切换度量，会发现 HTM 额外允许两条 R2 捷径。此小实验独立于上方魔方。', 'This is the complete Cayley graph of the subgroup ⟨R⟩, not a miniature of the full cube group. The four vertices are the whole-cube states after no move, R, R2 and R′. Each R step travels clockwise around the square. Switching to HTM adds two R2 shortcuts. This experiment is independent of the cube above.')}</p>
    <div className="cube-graph-lesson-controls">
      <CompactSelect label={metric.toUpperCase()} ariaLabel={t('凯莱图度量', 'Cayley graph metric')} value={metric} onChange={setMetric}
        items={[{ value: 'qtm', label: 'QTM' }, { value: 'htm', label: 'HTM' }]} />
      <label>{t('连续走 R', 'Consecutive R moves')}<input type="range" min="0" max="8" value={steps} onChange={event => setSteps(Number(event.target.value))} /><output>{steps}</output></label>
      <button type="button" disabled={steps === 8} onClick={() => setSteps(value => Math.min(value + 1, 8))}>{t('走 R', 'Step R')}</button>
      <button type="button" onClick={() => setSteps(0)}>{t('回到起点', 'Start over')}</button>
    </div>
    <svg viewBox="0 0 360 270" width="100%" style={{ maxWidth: 360, display: 'block', margin: '16px auto' }} role="img"
      aria-label={t(`R 子群的 ${metric.toUpperCase()} 凯莱图，当前状态 ${nodes[current].label}`, `${metric.toUpperCase()} Cayley graph of the R subgroup; current state ${nodes[current].label}`)}>
      {edges.map(([a, b], index) => <g key={`${a}-${b}`}>
        <line x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke={index < 4 ? 'var(--muted-foreground)' : 'var(--accent)'} strokeWidth="2" strokeDasharray={index < 4 ? undefined : '6 4'} />
      </g>)}
      {nodes.map((node, index) => <g key={node.label}>
        <circle cx={node.x} cy={node.y} r="25" fill="var(--background)" stroke={current === index ? 'var(--accent)' : 'var(--muted-foreground)'} strokeWidth={current === index ? 4 : 1} />
        <text x={node.x} y={node.y + 6} textAnchor="middle" fill="var(--foreground)" fontSize="18">{node.label}</text>
      </g>)}
      <text x="180" y="30" textAnchor="middle" fill="var(--foreground)" fontSize="14">R / R′</text>
      {metric === 'htm' && <text x="180" y="121" textAnchor="middle" fill="var(--foreground)" fontSize="14">R2</text>}
    </svg>
    <p role="status" data-cayley-readout>{t(`已走 ${steps} 步，当前状态 ${nodes[current].label}，距还原态最少 ${distance} 步（${metric.toUpperCase()}）。`, `Walked ${steps} moves; current state ${nodes[current].label}; shortest distance to solved: ${distance} (${metric.toUpperCase()}).`)}</p>
    <p>{t('试试走两次 R：QTM 距离是 2，HTM 距离是 1。再走到第四步：路径长 4，但回到 e，距离变成 0。路径长度记录你怎么走，距离只取所有走法中最短的那条。', 'Try two R moves: the distance is 2 in QTM and 1 in HTM. At the fourth move, the walk has length 4 but returns to e, so the distance is 0. Walk length records what you did; distance chooses the shortest of all possible walks.')}</p>

    <h3>{t('5. 公式是路径，关系是闭路', '5. Algorithms are walks; relations are closed walks')}</h3>
    <p>{t('R U 与 U R 一般到达不同状态，这就是魔方群不交换的具体表现。反过来，不同公式也可以到达同一状态：R R 与 R2 的效果相同，R R′ 与空公式都回到 e。凯莱图会把相同状态合并成同一个顶点，因此它不是“每串一律建新点”的转动序列树。', 'R U and U R generally reach different states: cube moves do not commute. Conversely, different algorithms can reach the same state: R R equals R2, while R R′ and the empty algorithm both reach e. A Cayley graph merges equal states into one vertex; it is not a sequence tree that creates a new vertex for every word.')}</p>
    <p>{t('R⁴ = e 给出一条四步闭路，表示 R 的阶为 4，因为这是重复 R 首次回到 e 的正次数。但任意闭路的长度不等于某个元素的阶：R R′ 是两步往返，其乘积是阶为 1 的单位元。应区分“一串操作的长度”和“重复同一操作多少次首次还原”。', 'R⁴ = e gives a four-step closed walk. R has order 4 because four is the first positive repetition count returning to e. An arbitrary closed walk does not measure an element’s order: R R′ is a two-step backtrack whose product is the identity, of order 1. Word length and the first repetition count returning to solved are different notions.')}</p>
    <p>{t('贴纸图上的五个四循环也不等于凯莱图里五个状态环。它们描述一次 R 同时怎样置换 20 个位置；凯莱图中的一条 R 边则把这整次置换作为一个动作。若只跟踪一枚贴纸，很多不同的整魔方状态会给出同一个位置，信息已经丢失，无法从它单独推回完整凯莱图。', 'The five four-cycles of stickers are not five cycles of whole-cube states. They describe how one R permutes 20 positions simultaneously; a single R edge in the Cayley graph applies that entire permutation. Tracking just one sticker loses information: many whole-cube states put that sticker in the same position, so its track cannot reconstruct the full Cayley graph.')}</p>

    <h3>{t('6. 还原、最短解与上帝之数', '6. Solving, shortest solutions and God’s number')}</h3>
    <p>{t('从 e 按 R U F 走到 g，沿 F′ U′ R′ 就能原路回去。这保证给出解，却未必最短。“沿原路还原”按钮做的就是这种逆序列；它不会搜索捷径。一般求解器寻找一条可行路径，最优求解器才需要证明没有更短的路径。', 'After R U F takes e to g, F′ U′ R′ retraces the route home. This guarantees a solution, not a shortest one. Retrace to solved above computes exactly this inverse sequence without searching for shortcuts. A general solver seeks a valid route; an optimal solver must also establish that no shorter route exists.')}</p>
    <p className="cube-graph-formula"><TeX src={String.raw`d_S(g,e)=\min\{k:\;gs_1\cdots s_k=e,\ s_i\in S\}`} /></p>
    <p>{t('在固定的无权图中，广度优先搜索按距离一层层展开，第一次找到目标即为最短解。但完整魔方图太大，实际算法会利用剪枝表、启发式搜索、子群和对称性减少工作量，而不是先把整张图存下来。', 'Breadth-first search expands an unweighted graph by distance, so the first route found to a target is shortest. The full cube graph is too large to store explicitly. Practical methods use pruning tables, heuristic search, subgroups and symmetries to reduce the work.')}</p>
    <p>{t('图的直径是任意两点间最短距离的最大值。凯莱图中，左乘同一个群元素保持边不变，因此每个顶点的周围结构相同；直径也就等于从 e 出发的最大距离。普通三阶在 HTM 下是 20，在 QTM 下是 26。这不表示每个打乱都需要这么多步，也不表示 20 个输入记号之后一定已还原。', 'A graph’s diameter is the largest shortest-path distance between two vertices. Left multiplication by a fixed group element preserves Cayley edges, so all vertices have the same surrounding structure; the diameter equals the greatest distance from e. For the ordinary 3×3 it is 20 in HTM and 26 in QTM. Not every scramble needs that many moves, and executing 20 arbitrary tokens does not guarantee a solution.')}</p>
    <p>{t('继续阅读：', 'Read further: ')}<Link href="/math/group/cayley" prefetch={false}>{t('凯莱图专题：球壳、生成集与小群实验', 'Cayley graphs: spheres, generators and small-group experiments')}</Link>{' / '}<Link href="/math/god" prefetch={false}>{t('上帝之数与计算证明', 'God’s number and its computational proof')}</Link></p>
    <p className="cube-graph-hint">{t('定义与数值参考：', 'Definitions and numerical references: ')}<a href="https://www.homepages.ucl.ac.uk/~ucahjmt/groups/structure/cayley/index.html" target="_blank" rel="noreferrer">UCL Cayley Graph Explorer</a>{' / '}<a href="https://www.cube20.org/" target="_blank" rel="noreferrer">HTM 20</a>{' / '}<a href="https://www.cube20.org/qtm/" target="_blank" rel="noreferrer">QTM 26</a></p>
  </section>;
}
