import type { Question } from '../types';

// 进阶 记号与度量 —— 各种 turn metric、异形魔方的官方记号、换位子写法。
export const NOTATION_HARD: Question[] = [
  {
    id: 'not-h01', cat: 'notation', type: 'choice',
    q: { zh: 'OBTM 度量里,Rw 和 y 各算几步?', en: 'In OBTM, how many moves are Rw and y?' },
    options: [
      { zh: 'Rw 算 1 步,y 算 0 步', en: 'Rw counts 1; y counts 0' },
      { zh: '各算 1 步', en: 'Both count 1' },
      { zh: 'Rw 算 2 步,y 算 0 步', en: 'Rw counts 2; y counts 0' },
      { zh: '各算 0 步', en: 'Neither counts' },
    ],
    answer: 0,
    why: { zh: '规则 12a5:Outer Block Turn Metric —— 面转和宽层转各 1 步,整体旋转 0 步。', en: 'Regulation 12a5 — Outer Block Turn Metric: face and wide turns count one, whole-cube rotations count zero.' },
  },
  {
    id: 'not-h02', cat: 'notation', type: 'choice',
    q: { zh: 'ETM 和 OBTM 的区别在哪?', en: 'How does ETM differ from OBTM?' },
    options: [
      { zh: 'ETM 里整体旋转也算 1 步', en: 'In ETM, whole-cube rotations also count as one move' },
      { zh: 'ETM 里半转算 2 步', en: 'In ETM, half turns count as two' },
      { zh: 'ETM 只数外层转动', en: 'ETM only counts outer-layer turns' },
      { zh: '两者完全一样', en: 'They are identical' },
    ],
    answer: 0,
    why: { zh: '规则 12a6:Execution Turn Metric 把你手上做的每一下都算一步 —— FMC 的 80 步上限用的就是它。', en: 'Regulation 12a6 — Execution Turn Metric counts everything you physically do. The 80-move Fewest Moves cap uses it.' },
  },
  {
    id: 'not-h03', cat: 'notation', type: 'choice',
    q: { zh: 'HTM 与 QTM 的区别是什么?', en: 'What is the difference between HTM and QTM?' },
    options: [
      { zh: 'U2 在 HTM 里算 1 步,在 QTM 里算 2 步', en: 'U2 counts as one move in HTM, two in QTM' },
      { zh: 'HTM 不允许 180 度转动', en: 'HTM does not allow half turns' },
      { zh: 'QTM 允许宽层转动', en: 'QTM allows wide turns' },
      { zh: '只是叫法不同', en: 'Just different names' },
    ],
    answer: 0,
    why: { zh: '所以上帝之数 HTM 是 20、QTM 是 26 —— 同一个魔方,两套尺子。', en: 'Hence God\'s number is 20 in HTM and 26 in QTM — same cube, different rulers.' },
  },
  {
    id: 'not-h04', cat: 'notation', type: 'choice',
    q: { zh: 'Square-1 记号 (X, Y) 里的一个单位是多少度?', en: 'In Square-1 notation (X, Y), one unit is how many degrees?' },
    options: [
      { zh: '30 度', en: '30°' },
      { zh: '60 度', en: '60°' },
      { zh: '90 度', en: '90°' },
      { zh: '15 度', en: '15°' },
    ],
    answer: 0,
    why: { zh: '规则 12c2:X、Y 是 −5 到 6 的整数,分别表示上下层顺时针转 X、Y 个 30 度,且不能同时为 0。', en: 'Regulation 12c2 — X and Y are integers from −5 to 6, clockwise units of 30° on the top and bottom, never both zero.' },
  },
  {
    id: 'not-h05', cat: 'notation', type: 'choice',
    q: { zh: 'Square-1 记号里的「/」是什么动作,计几步?', en: 'What does "/" do on a Square-1, and how much does it count?' },
    options: [
      { zh: '右半边翻 180 度,计 1 步', en: 'Flips the right half 180°, counting as one move' },
      { zh: '右半边翻 180 度,不计步', en: 'Flips the right half 180°, counting as zero' },
      { zh: '整个魔方翻面,计 1 步', en: 'Rotates the whole puzzle, counting as one' },
      { zh: '上层转 90 度,计 1 步', en: 'Turns the top 90°, counting as one' },
    ],
    answer: 0,
    why: { zh: '规则 12c3 / 12c4:(X, Y) 也是 1 步,所以 SQ1 的步数就是「(X,Y) 的个数 + / 的个数」。', en: 'Regulations 12c3 and 12c4 — an (X, Y) also counts as one, so a Square-1 move count is simply the pairs plus the slashes.' },
  },
  {
    id: 'not-h06', cat: 'notation', type: 'choice',
    q: { zh: '五魔方打乱记号里的 R++ 是转多少度?', en: 'In Megaminx scramble notation, how far does R++ turn?' },
    options: [
      { zh: '顺时针 144 度', en: '144° clockwise' },
      { zh: '顺时针 72 度', en: '72° clockwise' },
      { zh: '顺时针 180 度', en: '180° clockwise' },
      { zh: '顺时针 120 度', en: '120° clockwise' },
    ],
    answer: 0,
    why: { zh: '规则 12d2:R++ / D++ 是「除了顶面与左面交界那三块以外的整体」转 144 度(两格),R-- / D-- 是反向。', en: 'Regulation 12d2 — R++ and D++ turn everything except three pieces by 144° (two clicks); R-- and D-- reverse it.' },
  },
  {
    id: 'not-h07', cat: 'notation', type: 'choice',
    q: { zh: '五魔方打乱记号里的 U 转多少度?', en: 'How far does U turn in Megaminx scramble notation?' },
    options: [
      { zh: '72 度', en: '72°' },
      { zh: '90 度', en: '90°' },
      { zh: '144 度', en: '144°' },
      { zh: '120 度', en: '120°' },
    ],
    answer: 0,
    why: { zh: '规则 12d1:五边形的面,一格就是 360/5 = 72 度。', en: 'Regulation 12d1 — one click of a pentagonal face is 360/5 = 72°.' },
  },
  {
    id: 'not-h08', cat: 'notation', type: 'choice',
    q: { zh: '金字塔官方记号里,小写的 u l r b 指什么?', en: 'In Pyraminx notation, what do lowercase u, l, r and b mean?' },
    options: [
      { zh: '四个小角(tip)', en: 'The four tips' },
      { zh: '四个面的整体转动', en: 'Whole-face turns' },
      { zh: '逆时针转动', en: 'Anticlockwise turns' },
      { zh: '两层一起转', en: 'Two layers together' },
    ],
    answer: 0,
    why: { zh: '规则 12e2:大写是「那一侧的两层」,小写只转顶上那个小角,都是 120 度。', en: 'Regulation 12e2 — uppercase turns the two layers on that side, lowercase just the tip; both by 120°.' },
  },
  {
    id: 'not-h09', cat: 'notation', type: 'choice',
    q: { zh: '换位子 [A, B] 展开成公式是什么?', en: 'How does the commutator [A, B] expand into moves?' },
    options: [
      { zh: 'A B A\' B\'', en: 'A B A\' B\'' },
      { zh: 'A B\' A\' B', en: 'A B\' A\' B' },
      { zh: 'A A\' B B\'', en: 'A A\' B B\'' },
      { zh: 'A B B A', en: 'A B B A' },
    ],
    answer: 0,
    why: { zh: '盲拧的 3-style 就靠它:选一对只在少数块上「打架」的 A、B,换位子只动那几块。', en: 'It is the backbone of 3-style: pick A and B that only conflict on a few pieces, and the commutator moves just those.' },
  },
  {
    id: 'not-h10', cat: 'notation', type: 'choice',
    q: { zh: '「antipode」(对极点)在魔方语境里指什么?', en: 'What is an antipode, in cube terms?' },
    options: [
      { zh: '距离还原态最远的状态,也就是要走满上帝之数那么多步的状态', en: 'A state as far from solved as possible — one that needs the full God\'s number' },
      { zh: '和当前状态镜像对称的状态', en: 'The mirror image of the current state' },
      { zh: '打乱公式的逆', en: 'The inverse of the scramble' },
      { zh: '最容易还原的状态', en: 'The easiest state to solve' },
    ],
    answer: 0,
    why: { zh: '二阶的 antipode 一共 2,644 个(HTM 11 步),都能列举出来;三阶的 distance-20 状态至今只有估计值。', en: 'The 2×2 has exactly 2,644 antipodes at 11 HTM, all enumerable. The 3×3\'s distance-20 count is still only estimated.' },
  },
  {
    id: 'not-h11', cat: 'notation', type: 'choice',
    q: { zh: '三阶在切片度量(STM)下的上帝之数是多少?', en: 'What is God\'s number for the 3×3 in the slice-turn metric (STM)?' },
    options: [
      { zh: '还没证出来,只知道在 18 到 20 之间', en: 'Unproven — only known to lie between 18 and 20' },
      { zh: '恰好 20', en: 'Exactly 20' },
      { zh: '恰好 18', en: 'Exactly 18' },
      { zh: '恰好 26', en: 'Exactly 26' },
    ],
    answer: 0,
    why: { zh: 'STM 把 M / E / S 的切片转动也算 1 步。三阶最出名的度量里,唯独这个还没合拢。', en: 'STM counts an M, E or S slice as one move. Of the well-known 3×3 metrics, it is the one still open.' },
  },
  {
    id: 'not-h12', cat: 'notation', type: 'choice',
    q: { zh: '在四阶或更高阶上,3Rw 是合法记号吗?', en: 'Is 3Rw legal notation on a 4×4 or larger?' },
    options: [
      { zh: '合法;但在二阶三阶上不合法', en: 'Yes — though not on a 2×2 or 3×3' },
      { zh: '任何阶数都不合法', en: 'Never legal' },
      { zh: '任何阶数都合法', en: 'Always legal' },
      { zh: '只有奇数阶合法', en: 'Only on odd-order cubes' },
    ],
    answer: 0,
    why: { zh: '规则 12a2:n 必须满足 1 < n < N。所以 1Rw 永远不合法,3Rw 要 N ≥ 4 才有意义。', en: 'Regulation 12a2 requires 1 < n < N, so 1Rw is never valid and 3Rw needs N ≥ 4.' },
  },
];
