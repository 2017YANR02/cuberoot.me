'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import { TeXBlock } from '../primitives';
import { NAURU_STATES, NAURU_MOVES, NAURU_EDGES, NAURU_SPHERES, nauruPosition } from '../nauru-graph';

const SOURCE = 'https://commons.wikimedia.org/wiki/File:Symmetric_group_4;_Cayley_graph_as_half-turns_of_2%C3%972%C3%972_Rubik%27s_cube.svg';
const IMAGE = '/assets/math/nauru/pocket-cube-half-turns.svg';
const COLOURS = ['var(--signal-info)', 'var(--destructive)', 'var(--signal-success)'];
const DASHES = [undefined, '6 3', '2 3'];
const SUBHEADING = { fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, margin: '32px 0 14px', color: 'var(--ink)' };

function NauruExplorer() {
  const t = useT();
  const [path, setPath] = useState<number[]>([]);
  const [radius, setRadius] = useState(4);
  const current = path.reduce((id, move) => NAURU_STATES[id].neighbours[move], 0);
  const state = NAURU_STATES[current];
  const solution = [...state.word].reverse();
  const ballSize = NAURU_SPHERES.slice(0, radius + 1).reduce((sum, count) => sum + count, 0);

  return <div data-nauru-explorer>
    <h3 style={SUBHEADING}>{t('动手：沿半转边行走，观察最短解', 'Explore: walk along half-turn edges and inspect shortest solutions')}</h3>
    <p>{t('四位数按 URF、ULB、DRB、DLF 的位置顺序，记录四枚角块的编号；1234 是还原态。它足以唯一确定本子群中的整个二阶状态。下图按 G(12,5) 排布，线的交叉处没有顶点。', 'The four digits list corner identities at URF, ULB, DRB and DLF, in that order; 1234 is solved. They uniquely specify the whole pocket-cube state within this subgroup. The drawing uses a G(12,5) layout; crossings are not vertices.')}</p>
    <div className="gt-panel-input-row">
      {NAURU_MOVES.map((move, index) => <button className="gt-btn-ghost" type="button" key={move}
        onClick={() => setPath(previous => [...previous, index])}>{move}</button>)}
      <button className="gt-btn-ghost" type="button" disabled={!path.length} onClick={() => setPath(previous => previous.slice(0, -1))}>{t('撤回一步', 'Undo')}</button>
      <button className="gt-btn-ghost" type="button" disabled={!path.length} onClick={() => setPath([])}>{t('重置', 'Reset')}</button>
      <button className="gt-btn" type="button" disabled={current === 0}
        onClick={() => setPath(previous => [...previous, NAURU_MOVES.indexOf(solution[0])])}>{t('走一步最短解', 'One optimal step')}</button>
    </div>
    <div className="gt-panel-input-row" style={{ marginTop: 12 }}>
      <CompactSelect value={String(current)} label={state.permutation} ariaLabel={t('查看二阶半转状态', 'Inspect a pocket-cube half-turn state')}
        items={NAURU_STATES.map((item, index) => ({ value: String(index), label: `${item.permutation}: ${item.word.join(' ') || 'e'}` }))}
        onChange={value => setPath(NAURU_STATES[Number(value)].word.map(move => NAURU_MOVES.indexOf(move)))} />
      <label>{t('显示 BFS 到第几层', 'Highlight BFS through layer')} <input aria-label={t('BFS 层数', 'BFS depth')} type="range" min="0" max="4" step="1" value={radius} onChange={event => setRadius(Number(event.target.value))} /> <output>{radius}</output></label>
    </div>
    <p>{t(`半径 ${radius} 内包含 ${ballSize} 个状态；距离恰为 ${radius} 的有 ${NAURU_SPHERES[radius]} 个。`, `The ball of radius ${radius} contains ${ballSize} states; ${NAURU_SPHERES[radius]} are at distance exactly ${radius}.`)}</p>
    <svg viewBox="0 0 420 420" width="100%" style={{ maxWidth: 420, display: 'block', margin: '16px auto' }} role="img"
      aria-label={t(`瑙鲁图，24 个状态、36 条半转边，当前状态 ${state.permutation}`, `Nauru graph: 24 states and 36 half-turn edges; current state ${state.permutation}`)}>
      {NAURU_EDGES.map(edge => {
        const a = nauruPosition(edge.from), b = nauruPosition(edge.to);
        const active = edge.from === current || edge.to === current;
        return <line key={`${edge.from}-${edge.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={COLOURS[edge.move]} strokeDasharray={DASHES[edge.move]} strokeWidth={active ? 3 : 1.5}
          opacity={NAURU_STATES[edge.from].word.length <= radius && NAURU_STATES[edge.to].word.length <= radius ? 1 : 0.15} />;
      })}
      {NAURU_STATES.map((node, index) => {
        const position = nauruPosition(index);
        return <g key={node.permutation} opacity={node.word.length <= radius || index === current ? 1 : 0.25}>
          <title>{`${node.permutation}: ${node.word.join(' ') || 'e'}`}</title>
          <circle cx={position.x} cy={position.y} r="17" fill="var(--background)" stroke={index === current ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={index === current ? 4 : 1} />
          <text x={position.x} y={position.y + 3.5} textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="var(--foreground)">{node.permutation}</text>
        </g>;
      })}
    </svg>
    <p>{t('线型：U2 蓝色实线，R2 红色虚线，F2 绿色点线。', 'Edge styles: U2 blue solid, R2 red dashed, F2 green dotted.')}</p>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
      <VisualCube setup={state.word.join(' ')} view="iso" puzzleSize={2} size={120} local alt={t(`当前二阶状态 ${state.permutation}`, `Current pocket-cube state ${state.permutation}`)} />
      <div style={{ minWidth: 0 }}>
        <p role="status" data-nauru-status>{t(`状态 ${state.permutation}；已走 ${path.length} 步；最短距离 ${state.word.length}。`, `State ${state.permutation}; walked ${path.length} moves; shortest distance ${state.word.length}.`)}</p>
        <p>{t('一条最短还原公式：', 'One shortest solution: ')}<code>{solution.join(' ') || 'e'}</code></p>
      </div>
    </div>
    <p>{t('试着连续执行 U2、R2、U2、R2、U2、R2：六步后回到原点。再选一个距离为 4 的状态，逐次点击“走一步最短解”。下拉选择会从还原态载入一条最短路径；“撤回”回退你的实际路径，二者含义不同。BFS 滑块只调整层数高亮，不改变魔方状态。', 'Try U2, R2, U2, R2, U2, R2: six moves return to the start. Then select a state at distance 4 and follow “One optimal step”. Selecting a state loads a shortest path from solved; Undo retraces your actual walk. The BFS slider changes highlighting only, without changing the cube.')}</p>
  </div>;
}

export default function NauruGraphLesson() {
  const t = useT();
  return <section id="nauru" style={{ scrollMarginTop: 80, marginTop: 36 }}>
    <h2 style={{ ...SUBHEADING, fontSize: 28 }}>{t('二阶半转子群：为什么它的凯莱图是瑙鲁图？', 'The pocket-cube half-turn subgroup: why its Cayley graph is the Nauru graph')}</h2>
    <p>{t('这是一张可以完整画出的魔方状态图：每个小魔方是一个完整状态，每条彩色边是一次 180° 面转。在固定一个参考角块的约定下，U2、R2、F2 生成一个 24 阶子群；它同构于四个对象的对称群 S₄，其三生成元凯莱图就是瑙鲁图（Nauru graph）。下面先保留原图，再从魔方动作推导这个结论。', 'This cube state graph is small enough to draw in full: each miniature cube is a complete state, and each coloured edge is one 180° face turn. With a reference corner fixed, U2, R2 and F2 generate a subgroup of order 24, isomorphic to the symmetric group S₄. Its Cayley graph with these three generators is the Nauru graph. We reproduce the original illustration and then derive the identification from cube moves.')}</p>
    <figure style={{ margin: '24px 0' }}>
      <a href={IMAGE} target="_blank" rel="noreferrer" aria-label={t('新标签页打开原始矢量图', 'Open the original vector image in a new tab')}>
        {/* Preserve the paper background for the unmodified, externally authored illustration. */}
        <img src={IMAGE} width="500" height="500" loading="lazy" alt={t('Jim Fowler 绘制的瑙鲁图：24 个二阶魔方状态由红、绿、蓝三类半转边连接', 'Jim Fowler’s Nauru graph: 24 pocket-cube states joined by red, green and blue half-turn edges')}
          style={{ display: 'block', width: '100%', maxWidth: 500, height: 'auto', margin: '0 auto', background: 'white' }} />
      </a>
      <figcaption>{t('原图：', 'Original illustration: ')}<a href={SOURCE} target="_blank" rel="noreferrer">Jim Fowler, 2023</a>{' — '}<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>{t('。原始 SVG 未修改，点击可放大。原图红边表示 R2、绿边表示 F2、蓝边表示 U2；颜色区分的是操作，不是贴纸颜色。', '. The original SVG is unmodified; open it to zoom. Red edges denote R2, green F2 and blue U2. Edge colours identify moves, not sticker colours.')}</figcaption>
    </figure>

    <h3 style={SUBHEADING}>{t('1. 先约定状态空间：为什么不是 367 万个状态？', '1. Specify the state space: why not 3.67 million states?')}</h3>
    <p>{t('普通二阶没有中心块。通常把整体转体后的同一拼图视为同一状态；等价做法是把一枚指定角块的位置和朝向固定。这里选左下后角 DBL 作为参考，只使用不碰它的 U、R、F 三个面。允许这些面的所有四分之一转与半转时，完整状态空间有 7! × 3⁶ = 3,674,160 个状态。现在进一步只允许 U2、R2、F2，所能到达的只是其中一个很小的子群 H。', 'A pocket cube has no centres. Conventionally, whole-cube rotations do not create distinct puzzle states; equivalently, fix the position and orientation of one chosen corner. We fix DBL, the down-back-left corner, and use only the U, R and F faces, which leave it untouched. Allowing their quarter and half turns gives 7! × 3⁶ = 3,674,160 states. Restricting the moves to U2, R2 and F2 reaches only a small subgroup H.')}</p>
    <TeXBlock src={String.raw`H=\langle U^2,R^2,F^2\rangle,\qquad S=\{U^2,R^2,F^2\}.`} />
    <p>{t('“只允许半转”不等于“半转度量 HTM”：HTM 允许 90°、180°、270° 面转，并把它们各计一步；本图禁止 90° 与 270°，仅把每次 180° 计一步。下面的直径 4 属于这个受限图，不能用来替代完整二阶 HTM 的上帝之数 11。', '“Half turns only” is not the half-turn metric HTM. HTM allows 90°, 180° and 270° face turns, counting each as one move. This graph forbids 90° and 270° turns and counts each 180° turn as one step. Its diameter 4 belongs to this restricted graph; it does not replace the full pocket cube’s HTM diameter 11.')}</p>
    <p>{t('若保留外部坐标方向，又同时允许六个面的半转，枚举会得到 96 个角块状态，而非 24。这个集合内能够连接不同整体朝向的转体是 e、x2、y2、z2，共四种；忽略整体转体后才得到 96÷4=24。不能把 96 机械地除以立方体全部 24 种旋转，因为其他旋转会把状态带出这个受限集合。固定 DBL 的模型直接选定了每类的一个代表。', 'If an external frame is retained and all six face half turns are allowed, enumeration gives 96 corner states, not 24. The whole-cube rotations relating states within this restricted set are e, x2, y2 and z2. Identifying those orientations gives 96/4 = 24. Dividing mechanically by all 24 cube rotations would be incorrect: the other rotations leave this restricted set. Fixing DBL chooses one representative per class directly.')}</p>

    <h3 style={SUBHEADING}>{t('2. 从八个角块中找出四个“自由标签”', '2. Find four independent labels among the eight corners')}</h3>
    <p>{t('把立方体八个角按空间棋盘格分成两组交错四面体。第一组取 A={URF, ULB, DRB, DLF}，依次编号 1、2、3、4；另一组 B={UFL, UBR, DFR, DBL}。U/D 表示上/下，R/L 表示右/左，F/B 表示前/后。半转会同时翻转两个空间坐标的符号，因而保持这两组，且在标准角块朝向坐标中不产生扭转。', 'Split the eight cube corners into two alternating tetrahedra, like a spatial checkerboard. Let A={URF, ULB, DRB, DLF}, labelled 1, 2, 3, 4, and B={UFL, UBR, DFR, DBL}. U/D mean up/down, R/L right/left and F/B front/back. A half turn reverses two spatial coordinate signs, so it preserves both sets and creates no twist in the standard corner-orientation coordinates.')}</p>
    <div style={{ overflowX: 'auto' }}>
      <table className="gt-compare">
        <thead><tr><th>{t('操作', 'Move')}</th><th>{t('在 A 上的置换', 'Permutation on A')}</th><th>{t('在 B 上的置换', 'Permutation on B')}</th></tr></thead>
        <tbody>
          <tr><td>U2</td><td>(URF ULB) = (1 2)</td><td>(UFL UBR)</td></tr>
          <tr><td>R2</td><td>(URF DRB) = (1 3)</td><td>(UBR DFR)</td></tr>
          <tr><td>F2</td><td>(URF DLF) = (1 4)</td><td>(UFL DFR)</td></tr>
        </tbody>
      </table>
    </div>
    <p>{t('每个半转在八角块上是两个不相交对换的乘积，但限制到 A 上只剩一个对换。这解释了为什么整枚魔方的角置换是偶置换，而下文 S₄ 标签的奇偶性仍会在每一步翻转：它们是两个不同的置换作用。DBL 始终不动。', 'Each half turn is a product of two disjoint transpositions on the eight corners, but restricts to a single transposition on A. Thus the full eight-corner permutation is even, while the parity of its S₄ label flips at each step: these are different permutation actions. DBL stays fixed throughout.')}</p>

    <h3 style={SUBHEADING}>{t('3. 严格证明 H ≅ S₄，而不只是数到 24', '3. Prove H ≅ S₄, rather than merely counting to 24')}</h3>
    <p>{t('令 φ 把一个魔方操作限制到 A 上。限制作用保留合成，因此 φ:H→S₄ 是群同态。它把三个生成元送到 (1 2)、(1 3)、(1 4)。这些“星形对换”生成整个 S₄：任意不含 1 的对换 (i j) 都可写成 (1 i)(1 j)(1 i)，而所有对换生成对称群，所以 φ 是满射。', 'Let φ restrict a cube operation to A. Restriction respects composition, so φ:H→S₄ is a homomorphism. It sends the generators to (1 2), (1 3), (1 4). These star transpositions generate S₄: any transposition (i j) with i,j≠1 equals (1 i)(1 j)(1 i), and transpositions generate the symmetric group. Thus φ is surjective.')}</p>
    <p>{t('还必须排除“ A 已还原，B 却仍打乱”的核。考虑四个标签分成两对的三种方式 P₁=12|34、P₂=13|24、P₃=14|23。S₄ 自然地置换这三种配对。把 DFR、UFL、UBR 分别对应 P₁、P₂、P₃：检查上表，U2 固定 P₁ 并交换 P₂/P₃，R2 固定 P₂，F2 固定 P₃；恰好与 B 上的角块动作一致。', 'We must also rule out a kernel that restores A but scrambles B. There are three partitions of four labels into two pairs: P₁=12|34, P₂=13|24, P₃=14|23. S₄ acts on these partitions. Match DFR, UFL and UBR to P₁, P₂ and P₃ respectively. From the table, U2 fixes P₁ and swaps P₂/P₃; R2 fixes P₂; F2 fixes P₃. These are exactly the actions on B.')}</p>
    <p>{t('因此 B 上的作用完全由 A 上的置换决定。如果 A 上作用为恒等，则三种配对不变，B 也全部不动；DBL 固定，所有角块朝向又始终为零，于是整个二阶还原。故 ker φ={e}，φ 同时是单射，得到 H≅S₄ 以及 |H|=4!=24。这也说明另一组角块不能再独立乘一个 3!。', 'Consequently the action on B is determined entirely by the permutation on A. If the action on A is the identity, all three partitions and hence all of B are fixed; DBL is fixed and every corner twist is zero. The whole pocket cube is therefore solved. Thus ker φ={e}, making φ injective as well: H≅S₄ and |H|=4!=24. The other corners do not contribute an independent factor of 3!.')}</p>
    <TeXBlock src={String.raw`\operatorname{Cay}(H,S)\cong\operatorname{Cay}\bigl(S_4,\{(12),(13),(14)\}\bigr).`} />
    <p>{t('这里的 S₄ 来自角块标签的置换。正方体的刚体旋转群也同构于 S₄，但不是本段的魔方操作群；同样的抽象群可以有不同的物理实现。', 'Here S₄ arises from permutations of corner labels. The rigid rotational symmetry group of a cube is also isomorphic to S₄, but it is a different physical action from this group of puzzle moves.')}</p>

    <h3 style={SUBHEADING}>{t('4. 从转动规则生成这张图', '4. Construct the graph from the move rules')}</h3>
    <ol>
      <li>{t('从还原态 e 开始，保存全部角块的位置与朝向，并把它放入 BFS 队列。', 'Start from solved e, store all corner positions and orientations, and enqueue it for BFS.')}</li>
      <li>{t('依次取出一个状态，分别执行 U2、R2、F2。遇到未见过的状态就新建顶点并入队；已经见过则连接原有顶点，不能把不同公式误当成不同状态。', 'Remove a state from the queue and apply U2, R2 and F2. Add and enqueue each unseen state; otherwise connect to the existing vertex. Different words must not be mistaken for different states.')}</li>
      <li>{t('队列清空即完成全部枚举。记录生成元作为边标签，并合并两个方向：每个半转都满足 s²=e，是自身的逆。', 'When the queue is exhausted the enumeration is complete. Label each edge by its generator and merge the two directions: every half turn satisfies s²=e and is its own inverse.')}</li>
      <li>{t('最后为顶点选坐标、画边，并把顶点符号换成对应的二阶魔方缩略图。魔方状态与邻接关系决定数学对象；二维坐标只决定画法。', 'Finally choose vertex coordinates, draw the edges, and replace vertex symbols with thumbnails of the corresponding pocket-cube states. States and adjacency define the mathematical object; planar coordinates determine only its drawing.')}</li>
    </ol>
    <p>{t('每个顶点恰有三个不同邻居，所以这是三正则图；按握手定理，边数为 24×3÷2=36。每一种颜色在每个顶点只出现一次，因此一种颜色的 12 条边构成一个完美匹配。任意两种颜色合起来形成四个互不相交的六边形，对应两个生成元生成的 6 阶 S₃ 子群及其陪集。', 'Each vertex has three distinct neighbours, making the graph cubic. The handshake lemma gives 24×3/2=36 edges. Each colour occurs exactly once at every vertex, so its 12 edges form a perfect matching. Any two colours form four disjoint hexagons, corresponding to cosets of the order-six S₃ subgroup generated by those two moves.')}</p>

    <h3 style={SUBHEADING}>{t('5. 为什么是这幅十二角星形状？', '5. Why the twelve-pointed star layout?')}</h3>
    <p>{t('瑙鲁图还有一个标准构造：广义 Petersen 图 G(12,5)。取外圈顶点 u₀,…,u₁₁ 和内圈顶点 v₀,…,v₁₁，下标按模 12 计算，连接下列三类边。外圈连相邻点，内圈每次跳 5 格，再用辐条连接对应的内外点。这里的三类几何边不等于三种转动颜色。', 'A standard construction is the generalized Petersen graph G(12,5). Take outer vertices u₀,…,u₁₁ and inner vertices v₀,…,v₁₁, with subscripts modulo 12. Join consecutive outer vertices, inner vertices five steps apart, and corresponding inner/outer vertices by spokes. These three geometric edge types are not the three move colours.')}</p>
    <TeXBlock src={String.raw`u_i\!\sim\!u_{i+1},\qquad u_i\!\sim\!v_i,\qquad v_i\!\sim\!v_{i+5}.`} />
    <p>{t('原图采用了这种内外两圈的画法，并以魔方图标代替圆点。为了验证“确实是同一张图”，本页交互图为 24 个真实魔方状态给出这样的编号，并逐条检查上述邻接关系，而不只是比较顶点数和边数。十二角星是布局效果，不表示魔方有十二个面，也不表示边在交叉处可以转弯。', 'The original uses this two-ring layout with cube icons instead of dots. To establish that it really is the same graph, the interactive model assigns this labelling to all 24 actual cube states and checks every adjacency above, rather than merely comparing counts. The star is a layout feature: it does not imply twelve cube faces, and a path cannot turn at an edge crossing.')}</p>
    <p>{t('David Eppstein 在 2007 年用“瑙鲁图”命名这个早已出现在 Foster 对称图目录中的图，原因正是其标准画法让人联想到瑙鲁国旗上的十二角星。名称来自图形外观，不来自魔方结构。', 'David Eppstein proposed the name “Nauru graph” in 2007 for a graph already present in the Foster census of symmetric graphs. Its standard drawing recalls the twelve-pointed star on Nauru’s flag; the name concerns the drawing rather than the cube mechanism.')}{' '}<a href="https://11011110.github.io/blog/2007/12/12/many-faces-of.html" target="_blank" rel="noreferrer">{t('命名者的原文', 'The naming article')}</a></p>

    <h3 style={SUBHEADING}>{t('6. 从群关系读出二分性、围长与直径', '6. Read bipartiteness, girth and diameter from the group')}</h3>
    <p>{t('二分性：每个生成元在 A 上是奇置换，因此每走一步，四标签排列的奇偶性翻转。12 个偶排列与 12 个奇排列组成二分图的两部，任何圈都必须具有偶数长度。这里检验的是 A 上的奇偶性，不是八角块总置换的奇偶性。', 'Bipartiteness: every generator is odd on A, so every step flips the parity of the four-label permutation. The 12 even and 12 odd permutations form the two parts, and every cycle has even length. This is parity on A, not parity of the full eight-corner permutation.')}</p>
    <p>{t('围长为 6：同一半转连续两次是沿一条边往返，不构成简单圈。不同星形对换的乘积是 3-轮换，故 (U2 R2)³=e，得到六边形。没有三角形，因为图是二分图；也没有四边形，因为两个不同生成元构成的六种有序乘积是六个不同的 3-轮换，所以从同一顶点出发的两步不回头路径不会合并。于是最短简单圈恰为 6。', 'Girth 6: repeating the same half turn traverses one edge out and back, not a simple cycle. The product of two distinct star transpositions is a 3-cycle, so (U2 R2)³=e gives a hexagon. Bipartiteness rules out triangles. A square would make two non-backtracking paths of length two meet, but the six ordered products of distinct generators are six distinct 3-cycles. Thus there are no squares, and the shortest simple cycle has length 6.')}</p>
    <p>{t('直径为 4：从 e 做完整 BFS，距离 0、1、2、3、4 的状态数依次为 1、3、6、9、5，相加等于 24。所有顶点均已覆盖，且有状态需要 4 步。左乘任意群元素保持凯莱边，所以任意起点有相同的距离结构，图的直径与半径都等于 4。这是完整枚举的结论，不是由图上两点画得远近估计出来的。', 'Diameter 4: exhaustive BFS from e gives 1, 3, 6, 9, 5 states at distances 0 through 4, summing to 24. Every vertex is reached, and some require four moves. Left multiplication preserves Cayley edges, so every starting vertex has the same distance profile; both diameter and radius are 4. This is an exhaustive computation, not an estimate from geometric distances in the drawing.')}</p>
    <div style={{ overflowX: 'auto' }}><table className="gt-compare"><thead><tr><th>{t('最少半转次数 d', 'Minimum half turns d')}</th>{NAURU_SPHERES.map((_, depth) => <th key={depth}>{depth}</th>)}</tr></thead><tbody><tr><th>{t('状态数', 'States')}</th>{NAURU_SPHERES.map((count, depth) => <td key={depth}>{count}</td>)}</tr></tbody></table></div>
    <p>{t('还要区分群的阶与图的自同构群阶。这里用来生成顶点的群 H 有 24 个元素；忘掉边的颜色后，瑙鲁图的自同构群有 144 个元素，同构于 S₄×S₃。用“四个位置放三个有标号物体和一个空位”的模型理解最直接：一次操作交换空位与指定物体；任意重命名四个位置，以及任意重命名三个物体，都保持无色邻接关系。后者会置换三种操作颜色，因此若要求逐色保持，自同构只剩正则作用的 24 个。', 'Distinguish the order of the vertex-generating group from the graph automorphism group. H has 24 elements. After forgetting edge colours, the Nauru graph has 144 automorphisms, forming S₄×S₃. One model places three labelled objects and one vacancy in four positions; a move swaps the vacancy with a specified object. Relabelling the four positions or the three objects preserves uncoloured adjacency. Object relabelling permutes move colours, so requiring each colour to be preserved leaves the regular group of 24 automorphisms.')}</p>
    <NauruExplorer />
    <h3 style={SUBHEADING}>{t('资料与延伸阅读', 'Sources and further reading')}</h3>
    <ul>
      <li><a href={SOURCE} target="_blank" rel="noreferrer">Jim Fowler: {t('二阶半转凯莱图原图及授权', 'original pocket-cube Cayley illustration and licence')}</a>{t('。提供原图、作者与三种边颜色的含义。', '. Source for the illustration, authorship and edge-colour convention.')}</li>
      <li><a href="https://11011110.github.io/blog/2007/12/12/many-faces-of.html" target="_blank" rel="noreferrer">David Eppstein: The many faces of the Nauru graph</a>{t('。介绍星形对换、G(12,5)、自同构与不同画法。', '. Discusses star transpositions, G(12,5), automorphisms and alternative drawings.')}</li>
      <li><a href="https://www.jaapsch.net/puzzles/cube2.htm" target="_blank" rel="noreferrer">Jaap Scherphuis: Mini Cube</a>{t('。核对完整二阶的状态数与两种常用度量。', '. Reference for the full pocket-cube state count and standard metrics.')}</li>
      <li><a href="https://en.wikipedia.org/wiki/Nauru_graph" target="_blank" rel="noreferrer">{t('维基百科：瑙鲁图', 'Wikipedia: Nauru graph')}</a>{t('。原图所在条目，便于查阅更多图论性质与文献。', '. The article containing the illustration, with further graph-theoretic references.')}</li>
    </ul>
    <p>{t('本节的角块同构推导与交互枚举由本站实现；距离分布和 G(12,5) 邻接关系直接用现有魔方转动模型核验。', 'The corner-action proof and interactive enumeration are implemented here; the distance distribution and G(12,5) adjacency are verified using the site’s existing cube move model.')}</p>
    <p><Link href="/math/cube-graph#cayley-bridge" prefetch={false}>{t('对照贴纸位置图与状态凯莱图', 'Compare sticker-position diagrams and state Cayley graphs')}</Link>{' / '}<Link href="/math/god?event=222" prefetch={false}>{t('完整二阶状态空间与上帝之数', 'The full pocket-cube state space and God’s number')}</Link></p>
  </section>;
}
