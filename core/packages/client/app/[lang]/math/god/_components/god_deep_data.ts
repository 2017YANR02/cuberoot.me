/**
 * 每个项目的"深度博文"——300+ 字双语,讲历史 + 数学 + 算法细节。
 * 与 god_data.ts 的 `blurb` 互补:blurb 是 1 段总览,这里是 2-3 段深入。
 */

export interface DeepBlurb {
  /** 该项目的"看一遍就懂"标题。 */
  heading?: { zh: string; en: string
 };
  /** 多段。每段都是一个独立 paragraph (在 UI 里换段)。 */
  paragraphs: { zh: string; en: string
 }[];
  /** Optional 折叠时显示的副标题。 */
  tagline?: { zh: string; en: string
 };
}

export const DEEP: Record<string, DeepBlurb> = {
  '222': {
    heading: { zh: '小到一晚就能 BFS', en: 'Small enough to BFS overnight' },
    paragraphs: [
      {
        zh: '2×2 群 G 只有 367 万状态,因为它只有 8 个角块、没有边块、没有中心。固定 DBL 角作为锚以消去"整体旋转"的等价类,剩下 7 个可动角块 × 6 个朝向自由度 = 7! × 3⁶ = 3,674,160。一台 1981 年的 PC 都能在合理时间内 BFS 完整张 Cayley 图。',
        en: 'The 2×2 group has only 3.67M states because it has 8 corners and no edges or centres. Fixing one corner (DBL) to kill global rotation leaves 7 movable corners × 6 orientation DoF = 7! × 3⁶ = 3,674,160. A 1981-era PC could BFS the whole Cayley graph in reasonable time.'
    },
      {
        zh: '在 HTM 度量下,距离分布完美对称:绝大多数状态距离还原态 8-10 步,只有 2,644 个状态需要满 11 步。这 2,644 个 antipode 状态可以列举出来 —— 它们就是 2×2 上"最难"的所有打乱。在 QTM 度量下直径变为 14。',
        en: 'In HTM the distance distribution peaks around 8-10 moves; only 2,644 states require the full 11. Those 2,644 antipodes can be enumerated — they are literally every "hardest" 2×2 state. In QTM the diameter rises to 14.'
    },
      {
        zh: '有趣的事实:2×2 的随机状态平均最少解 ≈ 8.76 步 (HTM)。把 BFS 跑完一次,你就能算出这个数。',
        en: 'Fun fact: the average optimal solution length over all 2×2 states is ≈ 8.76 HTM. One BFS pass gives you this number for free.'
    },
    ],
  },

  '333': {
    heading: { zh: '魔方的"上帝之数 = 20"', en: 'The cube that gave us "God\'s number = 20"'
    },
    paragraphs: [
      {
        zh: '三阶群 G 有 4.3252 × 10¹⁹ 个状态(精确:43,252,003,274,489,856,000)。直接 BFS 完全不可行——光是存"每个状态距离多少步"也要 EB 级存储。Tomas Rokicki 团队 2010 年的胜利靠的是三件武器:陪集分解、对称压缩、集合覆盖。',
        en: 'The 3×3 group has 4.3252 × 10¹⁹ states (exactly 43,252,003,274,489,856,000). Naïve BFS is impossible — even storing one distance per state would take exabytes. Tomas Rokicki\'s 2010 victory came from three weapons: coset decomposition, symmetry compression, set cover.'
    },
      {
        zh: '关键子群 H = ⟨U, D, L², R², F², B²⟩ —— Kociemba 1992 年发明的"P1 子群"或"G1"。|H| = 19,508,428,800,因此 |G|/|H| = 2,217,093,120 个陪集。每个陪集是一组等价状态(在 H 内可互达),只需对每个陪集求一个"代表元最优解"。这把 4.3 × 10¹⁹ 维的图缩成 22 亿维。',
        en: 'The key subgroup is H = ⟨U, D, L², R², F², B²⟩ — Kociemba\'s 1992 "P1" or "G1" group. |H| = 19,508,428,800, so |G|/|H| = 2,217,093,120 cosets. Each coset is a set of states reachable from each other inside H; you only need one optimal solution per coset. That reduces a 4.3×10¹⁹-vertex graph to a 2.2-billion-vertex one.'
    },
      {
        zh: '再用立方体对称群 S₄₈ (48 个旋转 + 镜像) 把陪集压到 5588 万个;再用"集合覆盖"贪心选 ~80 个 super-cosets 一次性吞下相邻陪集——最后只需对每个 super-coset 实际求解。Google 集群 ~35 CPU-年跑完,2010-07-13 宣布:任意三阶状态都能 ≤ 20 步还原,且确实存在需 20 步的状态(superflip 是其中之一)。HTM 直径 = 20,上下界相合,证毕。',
        en: 'Then apply the 48-element cube symmetry group S₄₈ to crush cosets to 55.88M. Then a greedy set-cover absorbs neighbouring cosets into ~80 super-cosets that are actually solved. Google\'s cluster spent ~35 CPU-years; on 2010-07-13 they announced: every 3×3 state is solvable in ≤ 20 HTM, and some (e.g. superflip) actually need 20. Upper = lower = 20. QED.'
    },
      {
        zh: 'QTM 直径 26 是 2014 年(Rokicki & Davidson)用同套陪集框架证出的;切片度量(STM)目前只知道夹在 18 与 20 之间,尚未合拢,不是已证的精确值。三阶仍是上帝之数史上最干净的一胜:不仅给出 HTM 精确值,还给出 distance-20 antipode 状态的几何结构。',
        en: 'The QTM diameter of 26 was proven in 2014 (Rokicki & Davidson) with the same coset framework; the slice-turn metric (STM) is currently only bracketed between 18 and 20 — open, not a proven exact value. The 3×3 remains the cleanest victory in God\'s-number history: not just the exact HTM value, but also a geometric description of the distance-20 antipodes.'
    },
    ],
  },

  '444': {
    heading: { zh: '从来没人证过精确解', en: 'No one has ever proved an exact value'
    },
    paragraphs: [
      {
        zh: '4×4 群 G 有 7.40 × 10⁴⁵ 个状态——比三阶多 26 个数量级。不只是"大",还多了一类令人头疼的对称性:中心块的"看起来一样但实际不同"。把每面 4 个中心块当成可区分,|G| 还要乘 24⁶/2;通常我们用"看起来一样"的约定取较小数。',
        en: 'The 4×4 group has 7.40 × 10⁴⁵ states — 26 orders of magnitude larger than 3×3. And it brings a headache: centre cubies are physically indistinguishable. Treating them as distinct multiplies |G| by 24⁶/2; the convention is the smaller "visually-identical" count.'
    },
      {
        zh: '下界 35 来自 canonical-sequence 计数:深度 d 的合法序列数最多 N · M^(d-1),其中 M ≈ 25 (每步约 25 个生成元在去掉同轴上一步后)。求解 7.4 × 10⁴⁵ 个状态至少需要 d 满足 N · M^(d-1) ≥ |G|,反推 d ≥ 35。这是严格但非紧的下界。',
        en: 'The lower bound 35 comes from canonical-sequence counting: at depth d, the number of distinct sequences is at most N · M^(d-1), with M ≈ 25 (about 25 generators after rejecting same-axis-as-previous). To cover 7.4 × 10⁴⁵ states needs d such that N · M^(d-1) ≥ |G|, giving d ≥ 35. Rigorous but loose.'
    },
      {
        zh: '上界来自 reduction(归约)策略:先把 4×4 reduce 到 3×3(中心块还原 + 棱块配对),再用 3×3 算法解。Charles Tsai 的 8 步归约法给出 57 OBTM(Outer Block Turn Metric,允许 Rw / Lw 等宽转作为单步),经 Rokicki 复核;Shuang Chen 2015 年合并其中两步把上界压到 55。下界 35 与上界 55 之间还有 20 步的鸿沟,十几年没人合拢——4×4 是"最容易研究但最缺成果"的项目。',
        en: 'The upper bound comes from a reduction strategy: reduce 4×4 to 3×3 (centres + edge pairing), then solve as 3×3. Charles Tsai\'s 8-step reduction gives 57 OBTM (Outer Block Turn Metric, where Rw/Lw count as single moves), confirmed by Rokicki; Shuang Chen merged two of its stages in 2015 to drop the upper bound to 55. A 20-move gap between the lower bound 35 and upper bound 55 has gone un-closed for over a decade — 4×4 is "the most accessible unsolved puzzle, with the least progress".'
    },
    ],
  },

  '555': {
    heading: { zh: '宇宙原子数的 ÷ 10⁸', en: 'Atom count of the universe ÷ 10⁸'
    },
    paragraphs: [
      {
        zh: '5×5 群 G 有 2.83 × 10⁷⁴ 个状态——比可观测宇宙原子数 (~10⁸²) 少 8 个数量级。结构上 5×5 比 4×4 简单一点:每面有一个固定中心块(不像 4×4 的可换中心),所以"中心已固定"省了一些复杂度。',
        en: 'The 5×5 group has 2.83 × 10⁷⁴ states — 8 orders of magnitude short of the observable universe\'s atom count (~10⁸²). Structurally 5×5 is slightly cleaner than 4×4: each face has a fixed centre piece (unlike 4×4 swappable centres), saving some complexity.'
    },
      {
        zh: '上下界 52 / 130(OBTM)都是 reduction-style 估算。除了渐近 Θ(N²/log N) 是数学严证,精确直径完全无人触及。',
        en: 'The 52 / 130 OBTM bounds are both reduction-style estimates. Apart from the Θ(N²/log N) asymptotic, the exact diameter is untouched.'
    },
    ],
  },

  '666': {
    paragraphs: [
      {
        zh: '6×6 群 G 有 1.57 × 10¹¹⁶ 个状态。"宇宙原子数 (~10⁸²) 的平方再除一下"——这种数量级在物理学里没有有意义的对应物。',
        en: '6×6: 1.57 × 10¹¹⁶ states. Roughly "universe atom count squared, divided a bit" — no meaningful physical analogue.'
    },
      {
        zh: 'OBTM 只有一个社区计数得到的下界 75,至今没有公开的上界。',
        en: 'OBTM has only a community counting lower bound of 75 — no published upper bound.'
    },
    ],
  },

  '777': {
    heading: { zh: '终点:Θ(N²/log N) 渐近王者', en: 'Asymptotic regime: Θ(N²/log N)'
    },
    paragraphs: [
      {
        zh: '7×7 是 WCA 最大魔方,|G| = 1.95 × 10¹⁶⁰。Demaine 等人 2011 (arXiv:1106.5736) 证明 N 阶魔方的上帝之数为 Θ(N²/log N):',
        en: '7×7 is the largest WCA cube, |G| = 1.95 × 10¹⁶⁰. Demaine et al. 2011 (arXiv:1106.5736) proved the N×N God\'s number is Θ(N²/log N):'
    },
      {
        zh: '上界:把 N² 个 cubie 划成 O(N²/log N) 个"独立可对易"类,每类用并行子算法在 O(log N) 步内解决,合起来 O(N²/log N) 步。下界:canonical-sequence 计数对任何 N 都给 Ω(N²/log N)。两端匹配 ⇒ Θ(N²/log N)。常数因子很大、但增长阶数证毕。',
        en: 'Upper: partition N² cubies into O(N²/log N) "independently commuting" classes; solve each in O(log N) parallel moves; total O(N²/log N). Lower: canonical-sequence counting gives Ω(N²/log N) for any N. Matching ends ⇒ Θ(N²/log N). Constants are large, but the growth rate is settled.'
    },
    ],
  },

  'clock': {
    heading: { zh: '12 步——魔表的极简群', en: '12 moves — Clock\'s minimalist group'
    },
    paragraphs: [
      {
        zh: 'Rubik\'s Clock 的群结构与方块系全无关。它有 14 个独立的时钟轮(每个轮 12 个状态)+ 16 种针位组合。算上针位,总组合数 = 12¹⁴ × 16 ≈ 2.05 × 10¹⁶;但上帝之数是在 12¹⁴ ≈ 1.28 × 10¹⁵ 个表盘状态上计算的(针位只决定哪些轮联动,不改变求解距离)。一"步" = 由针位选定一组联动的轮,把它们一次转到 12 个钟点中的任意一个。',
        en: "Rubik's Clock has nothing to do with cubes structurally. It has 14 independent clock dials (12 states each) and 16 pin configurations. Counting pins, the total combination count is 12¹⁴ × 16 ≈ 2.05 × 10¹⁶; but the God's number is computed over the 12¹⁴ ≈ 1.28 × 10¹⁵ dial states (pins only choose which dials turn together, they don't change solving distance). One \"move\" turns the pin-selected group of dials, in a single twist, to any of the 12 clock positions."
    },
      {
        zh: 'Jakob Kogler (Jakube) 2014 年 5 月最早证出直径 = 12:用迭代加深 DFS + 一张约 1.5 GB(7 × 12⁸)的剪枝表。Tomas Rokicki 随后提出 front-cross 陪集法(把 14 轮按前十字分成约 9906 个对称类)独立复核,并算出完整距离分布——其中 39,248 个状态需要满 12 步。cube20.org 的 Clock 页(文献记为 2025-03-04)收录了这份分布,作为 11 年后的二次留档。',
        en: 'Jakob Kogler (Jakube) first proved diameter = 12 in May 2014 using iterative-deepening DFS + a ~1.5 GB (7 × 12⁸) pruning table. Tomas Rokicki then introduced the front-cross coset method (folding the 14 dials into ~9906 symmetry classes), independently re-verifying the result and computing the full distance distribution — 39,248 states need the full 12. cube20.org\'s Clock page (documented 2025-03-04) hosts that distribution as an 11-year-later record.'
    },
      {
        zh: '魔表是"已经证完了但几乎没人讨论"的项目——它太特殊,以至于很多扭计资料根本不提它。',
        en: "Clock is the rare event whose God's number is fully proved yet almost never discussed — too unlike the cubes, so most cubing literature ignores it."
    },
    ],
  },

  'minx': {
    heading: { zh: '五魔的下界 48 是怎么算出来的', en: 'How the Megaminx lower bound 48 was derived'
    },
    paragraphs: [
      {
        zh: 'Megaminx 有 12 个面 (每面 5 边正五边形),群序约 10⁶⁸ —— 介于三阶 (10¹⁹) 与四阶 (10⁴⁵) 之间……才怪,实际是 4×4 的 10²³ 倍。',
        en: 'Megaminx has 12 faces (each a 5-edge pentagon), group order ≈ 10⁶⁸ — comparable to between 3×3 (10¹⁹) and 4×4 (10⁴⁵)… not even close, it dwarfs 4×4 by 23 orders of magnitude.'
    },
      {
        zh: '下界走的是"对易面计数":两个不相邻的面(它们不共享任何块)可以独立旋转,这种独立性允许构造一个递推 total(n+1) = 36·total(n) − 240·total(n−1) − 320·total(n−2),给出深度 d 的合法序列上限,让它 ≥ 10⁶⁸ 即得下界。Kociemba 2012 年用这套论证得到 45 HTM;Tomas Rokicki 2016 年改进同一论证,把下界提到 48 HTM。',
        en: 'The lower bound uses "commuting-faces counting": two non-adjacent faces (sharing no cubie) rotate independently, giving the recurrence total(n+1) = 36·total(n) − 240·total(n−1) − 320·total(n−2) for canonical sequences at depth d; forcing total ≥ 10⁶⁸ yields the bound. Kociemba\'s 2012 argument gave 45 HTM; Tomas Rokicki refined the same argument in 2016 to push the lower bound to 48 HTM.'
    },
      {
        zh: '上界 194 是较早的社区粗略估计(reduction 类算法的最坏值);此后用子群链 / 两阶段求解器已把上界大幅压低(报到过 110 多步,但具体口径尚未公开核实)。无论如何,下界 48 与上界之间仍隔着上百步——精确直径遥遥无期。',
        en: 'The 194 upper bound is an older loose community estimate (reduction-style worst case); subgroup-chain / two-phase solvers have since pushed the ceiling much lower (figures in the 110s have been reported, though the exact metric is not yet publicly verified). Either way, a gap of over a hundred moves separates the 48 lower bound from the ceiling — an exact diameter is nowhere in sight.'
    },
    ],
  },

  'pyram': {
    paragraphs: [
      {
        zh: 'Pyraminx 是正四面体,4 个角 + 4 个中心三角 + 6 个边块。"核心"群(不算 4 个独立 tip 转轴)只有 933,120 状态——比 2×2 还小。Jaap Scherphuis 一夜 BFS 完。HTM 直径 11。',
        en: 'Pyraminx is a tetrahedron with 4 corners + 4 centre triangles + 6 edges. The "core" group (ignoring the 4 trivially-independent tips) has only 933,120 states — smaller than 2×2. Jaap Scherphuis BFSed it overnight. HTM diameter 11.'
    },
      {
        zh: '4 个 tip 各自有 3 个朝向,完全独立,所以"完整 Pyraminx"群序 = 933,120 × 3⁴ = 75,582,720,直径平凡地加 4 = 15。Pyraminx 比赛一般忽略 tip(它们不影响"颜色还原"判定),所以惯称"直径 11"。',
        en: 'Each of 4 tips has 3 orientations and is fully independent, so the "full Pyraminx" group order = 933,120 × 3⁴ = 75,582,720 and the diameter trivially gains 4 to 15. Competition typically ignores tips (they don\'t affect "solved-by-colour" judging), so the convention is "diameter 11".'
    },
    ],
  },

  'skewb': {
    paragraphs: [
      {
        zh: 'Skewb 是立方体的 corner-cut 变形,4 个角块独立可转(另 4 个由"奇偶"约束被动)+ 6 个中心面块可换。|G| = 3,149,280,BFS 几秒完成,直径 11。',
        en: 'Skewb is a corner-cut cube: 4 independent rotating corners (the other 4 are passively constrained by parity) + 6 permutable face centres. |G| = 3,149,280; BFS finishes in seconds; diameter 11.'
    },
      {
        zh: 'Skewb / Pyraminx / 2×2 三个"小群"项目都恰好是 11 HTM——一个有趣的巧合(或者说,一个反映 ~10⁶-10⁷ 状态空间在 6-9 个生成元下深度尺度的统计现象)。',
        en: 'Skewb / Pyraminx / 2×2 all hit diameter 11 — a curious coincidence (or rather, a statistical artifact of ~10⁶-10⁷ state spaces with 6-9 generators).'
    },
    ],
  },

  'sq1': {
    heading: { zh: 'SQ-1 的两种度量:13 vs 31', en: 'SQ-1\'s two metrics: 13 vs 31'
    },
    paragraphs: [
      {
        zh: 'Square-1 是"形状会变"的魔方:8 个 wide corner + 8 个 narrow edge piece 在顶/底层混排,中层是 2 块 + 一道剪切,形状本身就是动态的。|G| 取决于约定:常用 552,738,816,000 (折射对称视为不同) 或 435,891,456,000 (折射等价)。',
        en: 'Square-1 is a "shape-shifter": 8 wide corners + 8 narrow edges in the top/bottom layers, middle is 2 pieces + a slash; the shape itself is dynamic. |G| depends on convention: usually 552,738,816,000 (reflections distinct) or 435,891,456,000 (reflections identified).'
    },
      {
        zh: '两种度量给出两个完全不同的"直径":',
        en: 'Two metrics give two very different "diameters":'
    },
      {
        zh: 'twist metric:每个 /, +1, -1 各算一步,只能 twist 在形状允许时执行。Mike Masonjones 2005 完成穷举 BFS,直径 = 13。',
        en: 'twist metric: each /, +1, -1 counts as one move; twists only when shape permits. Mike Masonjones 2005 BFSed exhaustively, diameter = 13.'
    },
      {
        zh: 'face-turn metric:把顶层任意旋转算 1 步,把底层任意旋转算 1 步,/ 算 1 步。Shuang Chen (WCA 2008CHEN27) 2017-12 用 3816 个对称陪集 + 2-bit/state 磁盘 BFS (722 GB) 证出直径 = 31。这是磁盘 BFS 在魔方领域的里程碑。',
        en: 'face-turn metric: any rotation of the top layer = 1 move; any rotation of the bottom = 1; / = 1. Shuang Chen (WCA 2008CHEN27) Dec 2017 used 3816 symmetry cosets + 2-bit/state disk BFS (722 GB) to prove diameter = 31. A landmark for disk-BFS in cubing.'
    },
    ],
  },

  '333oh': {
    paragraphs: [
      {
        zh: '与三阶同群,直径仍是 20 HTM。手的数量不进入群论。',
        en: 'Same group as 3×3, diameter remains 20 HTM. Hand count is not in the group theory.'
    },
      {
        zh: 'OH 的"难"在执行而非解长度——单手转 R / R\' 比双手慢,但 20 步上限不变。',
        en: 'OH difficulty is execution speed, not solution length — one-handed R / R\' is slower than two hands, but the 20-move ceiling is the same.'
    },
    ],
  },

  '333bf': {
    paragraphs: [
      {
        zh: '蒙眼不改变群。所有 3×3 BLD 方法 (Old Pochmann / M2 / 3-style) 解长 50-100+ 步,远超 20 步上帝之数——因为方法是"易记忆"而非"短解"。',
        en: "Blindfolding doesn't change the group. All 3×3 BLD methods (Old Pochmann / M2 / 3-style) produce 50-100+ move solutions, well above the 20-move ceiling — because methods are optimized for memorability, not brevity."
    },
      {
        zh: 'BLD 训练核心是"建立 letter pair → cycle 的肌肉记忆",几乎与 group structure 无关。',
        en: 'BLD practice is about building "letter pair → cycle" muscle memory; almost nothing to do with group structure.'
    },
    ],
  },

  '333fm': {
    heading: { zh: 'FMC 的硬上限就是 20', en: 'FMC has a hard ceiling at 20' },
    paragraphs: [
      {
        zh: 'Fewest Moves Challenge 给选手 1 小时,要求找出 ≤ N 步的解,N 越小分越高。理论上 N 永远存在 ≤ 20 步的解(2010 cube20.org 证明)。',
        en: 'FMC gives 1 hour to find a ≤ N move solution; lower N = better score. In theory N ≤ 20 always exists (cube20.org 2010).'
    },
      {
        zh: '现实中人类找不到那么短。当前 FMC WR 是 16 步(单次,具体打乱有强结构)。平均 FMC WR(3 attempts average)约 21-22 步。普通选手单次 25-30 步,平均 28-32 步。',
        en: "Humans don't find optimal. Current FMC WR is 16 (single attempt, exceptionally structured scramble). Average WR (mean-of-3) is ~21-22. Typical competitors single 25-30 / average 28-32."
    },
      {
        zh: '把"随机 3×3 状态的最优解长度分布"称为最少步分布:据 Rokicki 团队公布,17-19 步状态占绝对多数(>99%),恰好 20 步的 antipode 状态非常稀有(占比 ~10⁻¹¹ 量级)。详见下方"3×3 距离分布"。',
        en: 'The distribution of optimal lengths over random 3×3 states is the "FMC distribution": per Rokicki, 17-19 dominates (>99%), and exact-20 antipodes are extremely rare (~10⁻¹¹). See "3×3 distance distribution" below.'
    },
    ],
  },

  '333mbf': {
    paragraphs: [
      {
        zh: 'MBLD 是 k 个独立 3×3 的笛卡尔积。群是 G^k,|G^k| = (4.3 × 10¹⁹)^k,直径 = 20k(每个魔方独立 ≤ 20 步)。',
        en: 'MBLD = Cartesian product of k independent 3×3 cubes. Group is G^k with |G^k| = (4.3 × 10¹⁹)^k; diameter = 20k (each cube ≤ 20 independently).'
    },
      {
        zh: '所以多盲在群论上完全平凡,所有难度都在"记 k 个独立 scramble"和盲解执行。WR 2020 由 Graham Siggins 完成 62/65 (1 小时内,k=65 个魔方)。',
        en: 'Multi-BLD is group-theoretically trivial; the difficulty is all in memorising k independent scrambles and blind execution. WR 2020 by Graham Siggins is 62/65 in 1 hour.'
    },
    ],
  },
};
