import type { Question } from '../types';

// 进阶 数学与组合 —— 群阶分解、距离分布、各项目上帝之数的现状。
// 数字与站内 /math/god 的数据表保持一致(那张表自己也标了出处)。
export const MATH_HARD: Question[] = [
  {
    id: 'mth-h01', cat: 'math', type: 'choice',
    q: { zh: '三阶魔方群的阶做质因数分解是什么?', en: 'What is the prime factorisation of the 3×3 group order?' },
    options: [
      { zh: '2²⁷ · 3¹⁴ · 5³ · 7² · 11', en: '2²⁷ · 3¹⁴ · 5³ · 7² · 11' },
      { zh: '2²⁰ · 3¹⁰ · 5⁵ · 7 · 13', en: '2²⁰ · 3¹⁰ · 5⁵ · 7 · 13' },
      { zh: '2³⁰ · 3¹² · 5² · 7³', en: '2³⁰ · 3¹² · 5² · 7³' },
      { zh: '2¹⁹ · 3¹⁹ · 5 · 7 · 11 · 13', en: '2¹⁹ · 3¹⁹ · 5 · 7 · 11 · 13' },
    ],
    answer: 0,
    why: { zh: '所以 11 是能整除群阶的最大素数 —— 群里存在阶为 11 的元素,却没有阶为 13 的。', en: 'So 11 is the largest prime dividing it: the group has elements of order 11, but none of order 13.' },
  },
  {
    id: 'mth-h02', cat: 'math', type: 'choice',
    q: { zh: '离还原态恰好 1 步的三阶状态有多少个?', en: 'How many 3×3 states are exactly one move from solved?' },
    options: [
      { zh: '18 个', en: '18' },
      { zh: '12 个', en: '12' },
      { zh: '6 个', en: '6' },
      { zh: '54 个', en: '54' },
    ],
    answer: 0,
    why: { zh: '6 个面 × 3 种转法(顺、逆、180 度)= 18,正好是 HTM 度量下的生成元个数。', en: 'Six faces × three turns each (clockwise, anticlockwise, half) = 18 — exactly the HTM generator count.' },
  },
  {
    id: 'mth-h03', cat: 'math', type: 'choice',
    q: { zh: '离还原态恰好 2 步的状态有多少个?', en: 'How many states are exactly two moves from solved?' },
    options: [
      { zh: '243 个', en: '243' },
      { zh: '324 个(也就是 18 × 18)', en: '324, i.e. 18 × 18' },
      { zh: '306 个', en: '306' },
      { zh: '216 个', en: '216' },
    ],
    answer: 0,
    why: { zh: '不是 18²:同一个面连转两次会退化成一步,对面之间的转动还可交换,重复要扣掉。', en: 'Not 18²: two turns of the same face collapse into one, and opposite faces commute, so duplicates come off.' },
  },
  {
    id: 'mth-h04', cat: 'math', type: 'choice',
    q: { zh: '需要走满 20 步的三阶状态究竟有多少个?', en: 'How many 3×3 states actually require the full 20 moves?' },
    options: [
      { zh: '精确值未知,估计约几亿个,占比不到十亿分之一', en: 'Unknown exactly — estimated at a few hundred million, under one in a billion' },
      { zh: '恰好 1 个,就是超级翻转', en: 'Exactly one: the superflip' },
      { zh: '恰好 2,644 个', en: 'Exactly 2,644' },
      { zh: '约占全部状态的 1%', en: 'About 1% of all states' },
    ],
    answer: 0,
    why: { zh: '证明只需要「不存在 21 步的状态」,不必数清 20 步的有多少;cube20.org 给的是约 4.9 亿这个量级的估计。', en: 'The proof only needed "no state requires 21", not a census of the 20s. cube20.org quotes an estimate around 490 million.' },
  },
  {
    id: 'mth-h05', cat: 'math', type: 'choice',
    q: { zh: '二阶在 HTM 下直径是 11,需要走满 11 步的状态有多少个?', en: 'The 2×2 has an HTM diameter of 11. How many states need all 11?' },
    options: [
      { zh: '2,644 个', en: '2,644' },
      { zh: '1 个', en: '1' },
      { zh: '约 3 万个', en: 'About 30,000' },
      { zh: '无人知道', en: 'Nobody knows' },
    ],
    answer: 0,
    why: { zh: '状态空间只有 367 万,一次完整 BFS 就能把它们全部列出来 —— 二阶上最难的打乱是可以逐个点名的。', en: 'With only 3.67M states, one full BFS enumerates them all — the hardest 2×2 scrambles can be listed by name.' },
  },
  {
    id: 'mth-h06', cat: 'math', type: 'choice',
    q: { zh: '二阶随机状态的平均最优解长度大约是多少(HTM)?', en: 'What is the average optimal solution length over all 2×2 states, in HTM?' },
    options: [
      { zh: '约 8.8 步', en: 'About 8.8 moves' },
      { zh: '约 11 步', en: 'About 11' },
      { zh: '约 4 步', en: 'About 4' },
      { zh: '约 14 步', en: 'About 14' },
    ],
    answer: 0,
    why: { zh: '约 8.76 步。分布集中在 8 到 10 步,11 步的极端情形只有两千多个。', en: 'About 8.76. The distribution clusters at 8–10, with only a couple of thousand states at 11.' },
  },
  {
    id: 'mth-h07', cat: 'math', type: 'choice',
    q: { zh: '四阶魔方的上帝之数目前是什么状况?', en: 'Where does the 4×4 God\'s number stand today?' },
    options: [
      { zh: '没证出来,只知道夹在 35 与 55 之间(OBTM)', en: 'Unproven — bracketed between 35 and 55 in OBTM' },
      { zh: '精确等于 55', en: 'Exactly 55' },
      { zh: '精确等于 35', en: 'Exactly 35' },
      { zh: '精确等于 20,和三阶一样', en: 'Exactly 20, same as the 3×3' },
    ],
    answer: 0,
    why: { zh: '下界 35 来自合法序列计数,上界 55 来自降阶法的最坏情形。这道 20 步的缝十几年没人合拢。', en: 'The lower bound 35 comes from counting canonical sequences, the upper 55 from a worst-case reduction. The 20-move gap has stood for over a decade.' },
  },
  {
    id: 'mth-h08', cat: 'math', type: 'choice',
    q: { zh: '五魔方上帝之数的已知下界是多少?', en: 'What is the best known lower bound for Megaminx?' },
    options: [
      { zh: '48 步(HTM)', en: '48 HTM' },
      { zh: '20 步', en: '20' },
      { zh: '194 步', en: '194' },
      { zh: '已经精确证出是 55 步', en: 'It is proven to be exactly 55' },
    ],
    answer: 0,
    why: { zh: 'Rokicki 2016 年在 Kociemba 2012 给出的 45 上改进得到 48;上界一直只有较粗的社区估计。', en: 'Rokicki improved Kociemba\'s 2012 figure of 45 to 48 in 2016. The upper bound remains a loose community estimate.' },
  },
  {
    id: 'mth-h09', cat: 'math', type: 'choice',
    q: { zh: 'N 阶魔方的上帝之数随 N 怎么增长?', en: 'How does the N×N God\'s number grow with N?' },
    options: [
      { zh: 'Θ(N² / log N)', en: 'Θ(N² / log N)' },
      { zh: 'Θ(N)', en: 'Θ(N)' },
      { zh: 'Θ(N³)', en: 'Θ(N³)' },
      { zh: 'Θ(2ᴺ)', en: 'Θ(2ᴺ)' },
    ],
    answer: 0,
    why: { zh: 'Demaine 等人 2011 年证明:上界靠把块分成可并行处理的类,下界靠合法序列计数,两头相合。', en: 'Demaine et al. (2011): the upper bound partitions pieces into parallel-solvable classes, the lower comes from sequence counting, and they meet.' },
  },
  {
    id: 'mth-h10', cat: 'math', type: 'choice',
    q: { zh: 'Square-1 一共有多少种状态?', en: 'How many states does a Square-1 have?' },
    options: [
      { zh: '约 5.5 × 10¹¹(552,738,816,000)', en: 'About 5.5 × 10¹¹ (552,738,816,000)' },
      { zh: '约 1.2 × 10¹³', en: 'About 1.2 × 10¹³' },
      { zh: '约 3.7 × 10⁶', en: 'About 3.7 × 10⁶' },
      { zh: '约 4.3 × 10¹⁹', en: 'About 4.3 × 10¹⁹' },
    ],
    answer: 0,
    why: { zh: '写成 170 · 2 · 8! · 8!,其中 170 是可达的形状数。', en: 'It factors as 170 · 2 · 8! · 8!, where 170 counts the reachable shapes.' },
  },
  {
    id: 'mth-h11', cat: 'math', type: 'choice',
    q: { zh: '魔表的上帝之数是几步、在多大的状态空间上证的?', en: 'What is Clock\'s God\'s number, and over how large a space was it proven?' },
    options: [
      { zh: '12 步,证在 12¹⁴ ≈ 1.28 × 10¹⁵ 个表盘状态上', en: '12 moves, proven over the 12¹⁴ ≈ 1.28 × 10¹⁵ dial states' },
      { zh: '20 步,证在 2 × 10¹⁶ 个状态上', en: '20 moves, over 2 × 10¹⁶ states' },
      { zh: '14 步,证在 12¹⁶ 个状态上', en: '14 moves, over 12¹⁶ states' },
      { zh: '还没证出来', en: 'Not yet proven' },
    ],
    answer: 0,
    why: { zh: '14 个钟盘各 12 个位置。算上 16 种针位组合总数更大(约 2.05 × 10¹⁶),但针位只决定哪些盘联动,不改变求解距离。', en: '14 dials of 12 positions each. Counting the 16 pin configurations gives ~2.05 × 10¹⁶, but pins only choose which dials move together.' },
  },
  {
    id: 'mth-h12', cat: 'math', type: 'choice',
    q: { zh: 'Kociemba 的子群 ⟨U, D, L², R², F², B²⟩ 有多少个陪集?', en: 'How many cosets does Kociemba\'s subgroup ⟨U, D, L², R², F², B²⟩ have?' },
    options: [
      { zh: '2,217,093,120 个', en: '2,217,093,120' },
      { zh: '19,508,428,800 个', en: '19,508,428,800' },
      { zh: '55,882,296 个', en: '55,882,296' },
      { zh: '43,252,003,274,489,856,000 个', en: '43,252,003,274,489,856,000' },
    ],
    answer: 0,
    why: { zh: '子群本身的阶是 19,508,428,800,群阶除以它就是 22.17 亿个陪集;再用 48 个对称压到约 5588 万。', en: 'The subgroup has order 19,508,428,800; dividing the group order gives 2.22 billion cosets, which symmetry crushes to ~55.88 million.' },
  },
  {
    id: 'mth-h13', cat: 'math', type: 'choice',
    q: { zh: '为什么随手贴的魔方只有 1/12 的概率可解?', en: 'Why is a randomly stickered cube solvable only one time in twelve?' },
    options: [
      { zh: '角块朝向要能被 3 整除、棱块翻转个数要偶、角棱置换的奇偶要一致,三个约束相乘 = 1/12', en: 'Corner twists must sum to a multiple of 3, flipped edges must be even, and corner/edge permutation parity must match — 3 × 2 × 2 = 12' },
      { zh: '因为六个中心块可以贴错', en: 'Because the six centres can be misplaced' },
      { zh: '因为有 12 个棱块', en: 'Because there are twelve edges' },
      { zh: '因为魔方有 12 条边', en: 'Because a cube has twelve edges' },
    ],
    answer: 0,
    why: { zh: '三个不变量各贡献一个因子:1/3 × 1/2 × 1/2 = 1/12。所以合法状态数是「所有贴法」的十二分之一。', en: 'Three invariants contribute 1/3, 1/2 and 1/2 — hence one twelfth of all stickerings is reachable.' },
  },
];
