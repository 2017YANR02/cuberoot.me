import type { Question } from './types';

// 解法与公式 —— 主流方法的名字、步骤和公式条数。
export const METHODS: Question[] = [
  {
    id: 'met-01', cat: 'methods', type: 'choice',
    q: { zh: 'CFOP 四个字母各代表哪一步?', en: 'What do the four letters of CFOP stand for?' },
    options: [
      { zh: '十字、前两层、顶面翻色、顶层归位', en: 'Cross, First two layers, Orient last layer, Permute last layer' },
      { zh: '角块、棱块、翻色、归位', en: 'Corners, edges, orientation, permutation' },
      { zh: '中心、十字、顶层、微调', en: 'Centres, cross, last layer, fixes' },
      { zh: '四个发明人的姓', en: 'The surnames of four inventors' },
    ],
    answer: 0,
    why: { zh: 'Cross → F2L → OLL → PLL,目前最主流的速拧方法。', en: 'Cross → F2L → OLL → PLL, by far the most popular speedsolving method.' },
  },
  {
    id: 'met-02', cat: 'methods', type: 'choice',
    q: { zh: 'PLL 一共有多少种情况(不含已经还原的)?', en: 'How many PLL cases are there (excluding the solved case)?' },
    options: [
      { zh: '21 种', en: '21' },
      { zh: '57 种', en: '57' },
      { zh: '41 种', en: '41' },
      { zh: '12 种', en: '12' },
    ],
    answer: 0,
    why: { zh: '21 条 PLL 加 57 条 OLL 就是完整 CFOP 的 78 条顶层公式。', en: '21 PLLs plus 57 OLLs make up the 78 last-layer algorithms of full CFOP.' },
  },
  {
    id: 'met-03', cat: 'methods', type: 'choice',
    q: { zh: 'OLL 一共有多少种情况?', en: 'How many OLL cases are there?' },
    options: [
      { zh: '57 种', en: '57' },
      { zh: '21 种', en: '21' },
      { zh: '78 种', en: '78' },
      { zh: '10 种', en: '10' },
    ],
    answer: 0,
  },
  {
    id: 'met-04', cat: 'methods', type: 'choice',
    q: { zh: 'F2L 是在做什么?', en: 'What does F2L do?' },
    options: [
      { zh: '把角块和对应棱块配成一对,一起插进底下两层', en: 'Pairing a corner with its edge and inserting them into the first two layers' },
      { zh: '先把四个棱块摆好', en: 'Placing the four edges first' },
      { zh: '把顶面拧成一色', en: 'Making the top face one colour' },
      { zh: '把中心块归位', en: 'Solving the centres' },
    ],
    answer: 0,
    why: { zh: 'First Two Layers —— 底层和第二层一起做完,是 CFOP 里最省时间的地方。', en: 'First Two Layers — doing both at once is where CFOP saves the most time.' },
  },
  {
    id: 'met-05', cat: 'methods', type: 'choice',
    q: { zh: '「两段式 OLL」(2-look OLL)大约要背几条公式?', en: 'Roughly how many algorithms does 2-look OLL need?' },
    options: [
      { zh: '10 条左右', en: 'About 10' },
      { zh: '2 条', en: '2' },
      { zh: '30 条左右', en: 'About 30' },
      { zh: '57 条', en: '57' },
    ],
    answer: 0,
    why: { zh: '先翻棱(3 种情况)、再翻角(7 种情况),分两步做就不用背满 57 条。', en: 'Orient the edges (3 cases) then the corners (7), and you avoid learning all 57.' },
  },
  {
    id: 'met-06', cat: 'methods', type: 'open',
    q: { zh: 'Roux 方法是以谁的名字命名的?', en: 'Whose name does the Roux method carry?' },
    answer: { zh: '法国人 Gilles Roux', en: 'Gilles Roux, from France' },
    accept: ['roux', 'gilles'],
  },
  {
    id: 'met-07', cat: 'methods', type: 'choice',
    q: { zh: 'Roux 方法的第一步是做什么?', en: 'How does a Roux solve start?' },
    options: [
      { zh: '在左右两侧各做一个 1×2×3 的块', en: 'Building a 1×2×3 block on each side' },
      { zh: '先做十字', en: 'Making a cross' },
      { zh: '先把棱全部翻正', en: 'Orienting all the edges' },
      { zh: '先还原顶面', en: 'Solving the top face' },
    ],
    answer: 0,
    why: { zh: 'Roux 的特点是靠 M 层滑动收尾,转动次数少但手法要求高。', en: 'Roux finishes with M-slice moves — very few turns, but a distinct feel.' },
  },
  {
    id: 'met-08', cat: 'methods', type: 'choice',
    q: { zh: 'ZZ 方法的招牌第一步叫什么?', en: 'What is the signature first step of ZZ?' },
    options: [
      { zh: 'EOLine —— 先把所有棱翻正', en: 'EOLine — orienting every edge up front' },
      { zh: '先做两个块', en: 'Building two blocks' },
      { zh: '先还原中心', en: 'Solving the centres' },
      { zh: '先记忆整个魔方', en: 'Memorising the whole cube' },
    ],
    answer: 0,
    why: { zh: '棱先翻正,后面就几乎只用 R U L 转动,不用再翻手腕。', en: 'With edges already oriented, the rest of the solve is almost pure R, U and L turns.' },
  },
  {
    id: 'met-09', cat: 'methods', type: 'choice',
    q: { zh: '入门教程常用的「层先法」是什么思路?', en: 'What is the idea behind the beginner\'s "layer by layer" method?' },
    options: [
      { zh: '一层一层地还原,先底层再中层再顶层', en: 'Solve one layer at a time: bottom, middle, then top' },
      { zh: '先把六个面的中心还原', en: 'Solve all six centres first' },
      { zh: '先角块全部还原再处理棱块', en: 'Solve every corner, then every edge' },
      { zh: '把魔方拆开重装', en: 'Take it apart and rebuild it' },
    ],
    answer: 0,
  },
  {
    id: 'met-10', cat: 'methods', type: 'choice',
    q: { zh: '盲拧最常见的入门方法之一叫什么?', en: 'Which is a common beginner method for blindfolded solving?' },
    options: [
      { zh: 'Old Pochmann', en: 'Old Pochmann' },
      { zh: 'CFOP', en: 'CFOP' },
      { zh: 'Roux', en: 'Roux' },
      { zh: 'ZZ', en: 'ZZ' },
    ],
    answer: 0,
    why: { zh: '用一条固定公式反复把块「送」到缓冲位,好学但步数多;进阶会转向 3-style。', en: 'It swaps pieces through a buffer with one repeated algorithm — easy to learn, move-heavy. Advanced solvers move to 3-style.' },
  },
  {
    id: 'met-11', cat: 'methods', type: 'choice',
    q: { zh: '盲拧里的「缓冲块」(buffer)是干什么的?', en: 'What is the "buffer" in blindfolded solving?' },
    options: [
      { zh: '一个固定的中转位置,块都经它倒手', en: 'A fixed staging spot that every piece passes through' },
      { zh: '记忆时用的口诀', en: 'A mnemonic used while memorising' },
      { zh: '还原前的缓冲时间', en: 'Spare time before the solve' },
      { zh: '备用的一个魔方', en: 'A backup cube' },
    ],
    answer: 0,
  },
  {
    id: 'met-12', cat: 'methods', type: 'choice',
    q: { zh: '「Speffz」是什么?', en: 'What is Speffz?' },
    options: [
      { zh: '给每张贴纸编字母的一套方案,盲拧用来记忆', en: 'A lettering scheme for stickers, used to memorise blindfolded solves' },
      { zh: '一个魔方品牌', en: 'A cube brand' },
      { zh: '一种打乱程序', en: 'A scrambling program' },
      { zh: '一套顶层公式', en: 'A set of last-layer algorithms' },
    ],
    answer: 0,
    why: { zh: '每个面 4 张贴纸依次编 A 到 X,把打乱变成一串字母去背。', en: 'Four stickers per face, lettered A through X, so a scramble becomes a string of letters to memorise.' },
  },
  {
    id: 'met-13', cat: 'methods', type: 'choice',
    q: { zh: '四阶魔方常用的「降阶法」(reduction)是什么意思?', en: 'What does the "reduction" method mean on a 4×4?' },
    options: [
      { zh: '先把中心和棱拼好,当成三阶来还原', en: 'Pair up the centres and edges, then solve it like a 3×3' },
      { zh: '把四阶拆成两个二阶', en: 'Split it into two 2×2s' },
      { zh: '减少打乱步数', en: 'Reducing the scramble length' },
      { zh: '只还原外面一圈', en: 'Solving only the outer ring' },
    ],
    answer: 0,
  },
];
