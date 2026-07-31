import type { Question } from './types';

// 数学与组合 —— 状态数、上帝之数这些人人都听过的数字,不碰群论细节。
export const MATH: Question[] = [
  {
    id: 'mth-01', cat: 'math', type: 'choice',
    q: { zh: '三阶魔方一共有多少种状态?', en: 'How many states does a 3×3 cube have?' },
    options: [
      { zh: '大约 4300 亿亿种(4.3×10¹⁹)', en: 'About 4.3×10¹⁹' },
      { zh: '大约 43 万种', en: 'About 430,000' },
      { zh: '大约 43 亿种', en: 'About 4.3 billion' },
      { zh: '无限多种', en: 'Infinitely many' },
    ],
    answer: 0,
    why: { zh: '精确值 43,252,003,274,489,856,000。一秒试一种,把宇宙年龄用完都试不完。', en: 'Exactly 43,252,003,274,489,856,000. One per second would outlast the age of the universe.' },
  },
  {
    id: 'mth-02', cat: 'math', type: 'choice',
    q: { zh: '「上帝之数」是 20,这句话在说什么?', en: 'God\'s number is 20 — what does that mean?' },
    options: [
      { zh: '任何打乱都能在 20 步以内还原', en: 'Any scramble can be solved in at most 20 moves' },
      { zh: '至少要 20 步才能还原', en: 'You always need at least 20 moves' },
      { zh: '平均要 20 步', en: 'The average solve takes 20 moves' },
      { zh: '有 20 种不可解状态', en: 'There are 20 unsolvable states' },
    ],
    answer: 0,
    why: { zh: '这是「最坏情况下的最少步数」,2010 年被穷举证明。', en: 'It is the worst-case optimal move count, proven by exhaustive search in 2010.' },
  },
  {
    id: 'mth-03', cat: 'math', type: 'choice',
    q: { zh: '三阶魔方有多少个可以动的小块?', en: 'How many movable pieces does a 3×3 have?' },
    options: [
      { zh: '26 个', en: '26' },
      { zh: '27 个', en: '27' },
      { zh: '54 个', en: '54' },
      { zh: '20 个', en: '20' },
    ],
    answer: 0,
    why: { zh: '8 个角块 + 12 个棱块 + 6 个中心块 = 26;正中间那个位置是转轴,没有块。', en: '8 corners + 12 edges + 6 centres = 26. The middle spot holds the core, not a piece.' },
  },
  {
    id: 'mth-04', cat: 'math', type: 'choice',
    q: { zh: '三阶魔方一共有多少张贴纸?', en: 'How many stickers are on a 3×3?' },
    options: [
      { zh: '54 张', en: '54' },
      { zh: '48 张', en: '48' },
      { zh: '26 张', en: '26' },
      { zh: '64 张', en: '64' },
    ],
    answer: 0,
    why: { zh: '6 个面 × 9 张。', en: 'Six faces of nine.' },
  },
  {
    id: 'mth-05', cat: 'math', type: 'choice',
    q: { zh: '三阶的中心块能换到别的面去吗?', en: 'Can the centre pieces of a 3×3 swap faces?' },
    options: [
      { zh: '不能,它们的相对位置永远固定', en: 'No — their relative positions never change' },
      { zh: '能,随便换', en: 'Yes, freely' },
      { zh: '能,但要用特殊公式', en: 'Yes, with a special algorithm' },
      { zh: '只有对面之间能换', en: 'Only opposite faces can swap' },
    ],
    answer: 0,
    why: { zh: '所以中心块的颜色就是这一面的「身份证」,配色关系永远不变。', en: 'That is why a centre defines its face — the colour scheme can never rearrange.' },
  },
  {
    id: 'mth-06', cat: 'math', type: 'choice',
    q: { zh: '把贴纸全撕下来随便重贴,魔方还一定能还原吗?', en: 'If you peel off every sticker and reapply them at random, is the cube still solvable?' },
    options: [
      { zh: '不一定,绝大多数贴法都拧不回去', en: 'Usually not — most arrangements are impossible' },
      { zh: '一定能', en: 'Always' },
      { zh: '只要六个中心贴对就能', en: 'Yes, as long as the six centres are right' },
      { zh: '拆开重装就能', en: 'Yes, if you take it apart and rebuild it' },
    ],
    answer: 0,
    why: { zh: '合法状态只占所有贴法的 1/12,随手贴基本会撞上不可解的情况。', en: 'Only one in twelve arrangements is reachable by turning, so random stickering almost always lands on an impossible one.' },
  },
  {
    id: 'mth-07', cat: 'math', type: 'choice',
    q: { zh: '只把一个角块原地转 120 度,其他都不动 —— 这种状态能还原吗?', en: 'One corner twisted 120° in place, everything else solved — is that solvable?' },
    options: [
      { zh: '不能,单个角块自转是不可能出现的', en: 'No — a single twisted corner cannot occur from turning' },
      { zh: '能,有专门公式', en: 'Yes, there is an algorithm for it' },
      { zh: '能,多拧几遍就好了', en: 'Yes, just keep turning' },
      { zh: '只有高阶魔方才不能', en: 'Only impossible on bigger cubes' },
    ],
    answer: 0,
    why: { zh: '正常转动下,八个角块的扭转量之和必须是 3 的倍数。见到这种情况多半是魔方拆装错了。', en: 'Corner twists must always sum to a multiple of three. Seeing this means the cube was reassembled wrongly.' },
  },
  {
    id: 'mth-08', cat: 'math', type: 'choice',
    q: { zh: '只交换两个棱块、别的都不动,可能吗?', en: 'Can exactly two edges swap while nothing else moves?' },
    options: [
      { zh: '不可能', en: 'No' },
      { zh: '可能', en: 'Yes' },
      { zh: '只有四阶可以', en: 'Only on a 4×4' },
      { zh: '要看打乱', en: 'It depends on the scramble' },
    ],
    answer: 0,
    why: { zh: '每转一次都同时打乱角和棱,置换的奇偶性绑在一起,单独的两两交换出不来。', en: 'Every turn permutes corners and edges together, so their parities are locked and a lone 2-swap is unreachable.' },
  },
  {
    id: 'mth-09', cat: 'math', type: 'choice',
    q: { zh: '二阶魔方有多少种状态?', en: 'How many states does a 2×2 have?' },
    options: [
      { zh: '约 367 万种', en: 'About 3.67 million' },
      { zh: '约 4 万种', en: 'About 40,000' },
      { zh: '约 40 亿种', en: 'About 4 billion' },
      { zh: '约 4.3×10¹⁹ 种', en: 'About 4.3×10¹⁹' },
    ],
    answer: 0,
    why: { zh: '精确值 3,674,160 —— 比三阶少了十几个数量级,所以电脑可以直接查表最优解。', en: 'Exactly 3,674,160 — small enough that a computer can look up an optimal solution for every one.' },
  },
  {
    id: 'mth-10', cat: 'math', type: 'choice',
    q: { zh: '「超级翻转」(superflip)是什么样的状态?', en: 'What is the "superflip"?' },
    options: [
      { zh: '所有块都在自己位置上,但 12 个棱全部翻转', en: 'Every piece home, but all twelve edges flipped' },
      { zh: '整个魔方每一面都是花纹', en: 'A pattern on every face' },
      { zh: '角块全部转了 120 度', en: 'All eight corners twisted' },
      { zh: '两个面互换了颜色', en: 'Two faces have swapped colours' },
    ],
    answer: 0,
    why: { zh: '它是最有名的「需要满 20 步」的状态,也是研究上帝之数时的经典例子。', en: 'It is the famous state that needs a full 20 moves, and the classic example in the God\'s-number story.' },
  },
  {
    id: 'mth-11', cat: 'math', type: 'choice',
    q: { zh: '为什么四阶魔方比三阶多出「奇偶」这种麻烦?', en: 'Why do parity cases appear on a 4×4 but not a 3×3?' },
    options: [
      { zh: '因为它没有固定的中心块,棱块还是成对的', en: 'Its centres are not fixed and its edges come in pairs' },
      { zh: '因为它更大更难转', en: 'Because it is bigger and stiffer' },
      { zh: '因为它的贴纸更多', en: 'Because it has more stickers' },
      { zh: '因为它是后来才发明的', en: 'Because it was invented later' },
    ],
    answer: 0,
  },
  {
    id: 'mth-12', cat: 'math', type: 'choice',
    q: { zh: '一条公式重复执行下去,最后一定会回到原状态吗?', en: 'If you repeat one algorithm over and over, will the cube always return to where it started?' },
    options: [
      { zh: '一定会,重复足够多次就回来了', en: 'Yes — repeat it enough times and it comes back' },
      { zh: '不一定,可能永远回不来', en: 'Not necessarily; it may never come back' },
      { zh: '只有 4 步以内的公式才会', en: 'Only for algorithms of four moves or fewer' },
      { zh: '只有对称的公式才会', en: 'Only for symmetric algorithms' },
    ],
    answer: 0,
    why: { zh: '状态数是有限的,任何固定操作反复做都会绕成一个圈;这个圈长叫这条公式的「阶」。', en: 'With finitely many states, any fixed sequence must cycle. That cycle length is the algorithm\'s order.' },
  },
];
