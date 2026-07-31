import type { Question } from '../types';

// 进阶 历史与人物 —— 专利、证明、纪录里程碑。日期与人名都核对过出处。
export const HISTORY_HARD: Question[] = [
  {
    id: 'hist-h01', cat: 'history', type: 'choice',
    q: { zh: '早于鲁比克,谁就为「可分组转动的方块」拿到了美国专利?', en: 'Who patented a "puzzle with pieces rotatable in groups" in the US before Rubik?' },
    options: [
      { zh: 'Larry Nichols,1972 年', en: 'Larry Nichols, 1972' },
      { zh: 'David Singmaster,1979 年', en: 'David Singmaster, 1979' },
      { zh: 'Uwe Mèffert,1970 年', en: 'Uwe Mèffert, 1970' },
      { zh: 'Ideal Toy 公司,1975 年', en: 'Ideal Toy, 1975' },
    ],
    answer: 0,
    why: {
      zh: 'Nichols 1970 年做出一个用磁铁固定的 2×2,1972 年拿到美国专利 3,655,201,后来还打赢了对 Ideal Toy 的侵权诉讼。',
      en: 'Nichols built a magnet-held 2×2 in 1970 and received US patent 3,655,201 in 1972; he later won an infringement suit against Ideal Toy.',
    },
  },
  {
    id: 'hist-h02', cat: 'history', type: 'choice',
    q: { zh: '日本人石毛照敏(Terutoshi Ishige)在 1976 年做了什么?', en: 'What did Terutoshi Ishige do in 1976?' },
    options: [
      { zh: '独立发明并申请了三阶魔方的日本专利', en: 'Independently invented a 3×3 cube and filed a Japanese patent' },
      { zh: '第一个把魔方卖到美国', en: 'First imported the cube to the USA' },
      { zh: '发明了魔尺', en: 'Invented the Rubik\'s Snake' },
      { zh: '办了第一场速拧比赛', en: 'Organised the first speedcubing contest' },
    ],
    answer: 0,
    why: { zh: '结构与鲁比克的方案几乎同构,是魔方史上著名的「平行发明」。', en: 'His mechanism was near-identical to Rubik\'s — a famous case of parallel invention.' },
  },
  {
    id: 'hist-h03', cat: 'history', type: 'choice',
    q: { zh: '现在通行的 R U F 字母记号,主要是谁确立的?', en: 'Who established the R U F letter notation we use today?' },
    options: [
      { zh: 'David Singmaster', en: 'David Singmaster' },
      { zh: 'Ernő Rubik', en: 'Ernő Rubik' },
      { zh: 'Jessica Fridrich', en: 'Jessica Fridrich' },
      { zh: 'Herbert Kociemba', en: 'Herbert Kociemba' },
    ],
    answer: 0,
    why: { zh: '英国数学家 Singmaster 在 1980 年前后的《Notes on Rubik\'s Magic Cube》里定下这套写法,沿用至今。', en: 'The British mathematician set it out in "Notes on Rubik\'s Magic Cube" around 1980, and it stuck.' },
  },
  {
    id: 'hist-h04', cat: 'history', type: 'choice',
    q: { zh: '魔方在匈牙利本土正式上市是哪一年?', en: 'When did the cube first go on sale in Hungary?' },
    options: [
      { zh: '1977 年', en: '1977' },
      { zh: '1974 年', en: '1974' },
      { zh: '1980 年', en: '1980' },
      { zh: '1982 年', en: '1982' },
    ],
    answer: 0,
    why: { zh: '1974 年做原型、1975 年申请专利、1977 年匈牙利上市、1980 年由 Ideal Toy 推向全球。', en: 'Prototype 1974, patent 1975, Hungarian release 1977, worldwide via Ideal Toy in 1980.' },
  },
  {
    id: 'hist-h05', cat: 'history', type: 'choice',
    q: { zh: '1982 年首届世界锦标赛比了几个项目?', en: 'How many events were held at the 1982 World Championship?' },
    options: [
      { zh: '只有三阶一个', en: 'Just one — 3×3' },
      { zh: '三个', en: 'Three' },
      { zh: '五个', en: 'Five' },
      { zh: '八个', en: 'Eight' },
    ],
    answer: 0,
    why: { zh: '只比三阶单次,每人三次尝试取最好;今天那 17 个项目是后来几十年慢慢长出来的。', en: 'Only the 3×3, best of three attempts. Today\'s 17 events accumulated over the following decades.' },
  },
  {
    id: 'hist-h06', cat: 'history', type: 'choice',
    q: { zh: '2010 年证明「上帝之数 = 20」用的关键手法是什么?', en: 'What was the key technique behind the 2010 proof that God\'s number is 20?' },
    options: [
      { zh: '按 Kociemba 子群做陪集分解,再用对称性和集合覆盖压缩', en: 'Coset decomposition over Kociemba\'s subgroup, then symmetry and set-cover compression' },
      { zh: '把 4.3×10¹⁹ 个状态全部逐个 BFS', en: 'A plain BFS over all 4.3×10¹⁹ states' },
      { zh: '用神经网络估计上界', en: 'A neural network estimating the bound' },
      { zh: '人工枚举所有公式', en: 'Enumerating algorithms by hand' },
    ],
    answer: 0,
    why: {
      zh: '子群 ⟨U, D, L², R², F², B²⟩ 把状态空间切成 2,217,093,120 个陪集,靠 48 个对称再压到约 5588 万,最后只对少量「超陪集」真正求解。',
      en: 'The subgroup ⟨U, D, L², R², F², B²⟩ splits the space into 2,217,093,120 cosets, symmetry crushes that to ~55.88M, and only a few super-cosets are actually solved.',
    },
  },
  {
    id: 'hist-h07', cat: 'history', type: 'choice',
    q: { zh: '那次证明大约烧了多少算力?', en: 'Roughly how much computing time did that proof take?' },
    options: [
      { zh: '约 35 CPU-年(Google 的集群)', en: 'About 35 CPU-years, on Google\'s cluster' },
      { zh: '约 3 天,一台笔记本', en: 'About three days on a laptop' },
      { zh: '约 1000 CPU-年', en: 'About 1,000 CPU-years' },
      { zh: '一块显卡跑了一小时', en: 'One GPU, one hour' },
    ],
    answer: 0,
  },
  {
    id: 'hist-h08', cat: 'history', type: 'choice',
    q: { zh: '四分之一转度量(QTM)下的上帝之数 26 是哪一年证出的?', en: 'When was God\'s number in the quarter-turn metric proven to be 26?' },
    options: [
      { zh: '2014 年,Rokicki 与 Davidson', en: '2014, by Rokicki and Davidson' },
      { zh: '2010 年,与 HTM 同时', en: '2010, alongside the HTM result' },
      { zh: '2019 年', en: '2019' },
      { zh: '至今未证', en: 'Still unproven' },
    ],
    answer: 0,
    why: { zh: '同一套陪集框架,换到 QTM 又跑了约 29 CPU-年。', en: 'Same coset framework, another ~29 CPU-years in the quarter-turn metric.' },
  },
  {
    id: 'hist-h09', cat: 'history', type: 'choice',
    q: { zh: '魔表(Clock)的上帝之数是多少、谁先证的?', en: 'What is God\'s number for the Rubik\'s Clock, and who proved it first?' },
    options: [
      { zh: '12 步,Jakob Kogler 于 2014 年', en: '12 moves, first proven by Jakob Kogler in 2014' },
      { zh: '20 步,Rokicki 于 2010 年', en: '20 moves, Rokicki in 2010' },
      { zh: '31 步,Shuang Chen 于 2017 年', en: '31 moves, Shuang Chen in 2017' },
      { zh: '还没人证出来', en: 'Nobody has proven it' },
    ],
    answer: 0,
    why: { zh: '迭代加深 DFS 加一张约 1.5 GB 的剪枝表;后来 Rokicki 用陪集法复核并算出完整距离分布。', en: 'Iterative-deepening DFS plus a ~1.5 GB pruning table; Rokicki later re-verified it with cosets and computed the full distribution.' },
  },
  {
    id: 'hist-h10', cat: 'history', type: 'choice',
    q: { zh: 'Square-1 在面转度量下的上帝之数 31 是谁证的?', en: 'Who proved Square-1\'s face-turn God\'s number of 31?' },
    options: [
      { zh: 'Shuang Chen,2017 年', en: 'Shuang Chen, 2017' },
      { zh: 'Mike Masonjones,2005 年', en: 'Mike Masonjones, 2005' },
      { zh: 'Jaap Scherphuis,1999 年', en: 'Jaap Scherphuis, 1999' },
      { zh: 'Tomas Rokicki,2014 年', en: 'Tomas Rokicki, 2014' },
    ],
    answer: 0,
    why: { zh: '3816 个对称陪集 + 每状态 2 bit 的磁盘 BFS,总共 722 GB。Masonjones 2005 年证的是另一种度量(twist metric)下的 13。', en: '3,816 symmetry cosets and a 2-bit-per-state disk BFS totalling 722 GB. Masonjones\'s 2005 result was 13 in the twist metric.' },
  },
  {
    id: 'hist-h11', cat: 'history', type: 'choice',
    q: { zh: '第一个官方 sub-10 的三阶单次是谁拧出来的?', en: 'Who set the first official sub-10 3×3 single?' },
    options: [
      { zh: 'Erik Akkersdijk,9.77(2007 年)', en: 'Erik Akkersdijk, 9.77 (2007)' },
      { zh: 'Feliks Zemdegs,9.21(2010 年)', en: 'Feliks Zemdegs, 9.21 (2010)' },
      { zh: 'Minh Thai,9.95(1982 年)', en: 'Minh Thai, 9.95 (1982)' },
      { zh: 'Yu Nakajima,8.72(2008 年)', en: 'Yu Nakajima, 8.72 (2008)' },
    ],
    answer: 0,
    why: { zh: '2007 年末破的 10 秒关口,不久后 Ron van Bruchem 拧出 9.55。', en: 'He broke the ten-second barrier in late 2007; Ron van Bruchem soon followed with 9.55.' },
  },
  {
    id: 'hist-h12', cat: 'history', type: 'choice',
    q: { zh: 'Erik Akkersdijk 那个著名的 7.08 保持了多久?', en: 'How long did Erik Akkersdijk\'s famous 7.08 stand?' },
    options: [
      { zh: '约两年半,2010 年被 Feliks Zemdegs 的 7.03 打破', en: 'About two and a half years, until Feliks Zemdegs\'s 7.03 in 2010' },
      { zh: '几个月', en: 'A few months' },
      { zh: '约八年', en: 'About eight years' },
      { zh: '至今未破', en: 'It still stands' },
    ],
    answer: 0,
    why: { zh: '2008 年 7 月创造,当时比前纪录一下快了 1.6 秒,是速拧史上最著名的一次断崖。', en: 'Set in July 2008, it cut 1.6s off the record in one go — the most famous single drop in speedcubing history.' },
  },
  {
    id: 'hist-h13', cat: 'history', type: 'open',
    q: { zh: '两阶段求解算法(先进子群再收尾)是谁提出的?', en: 'Who devised the two-phase solving algorithm used by most cube solvers?' },
    answer: { zh: 'Herbert Kociemba', en: 'Herbert Kociemba' },
    accept: ['kociemba'],
    why: { zh: '1992 年提出:先用任意转动把状态送进子群 ⟨U, D, L², R², F², B²⟩,再在子群内解完。上帝之数的证明也建在这个子群上。', en: 'His 1992 method drives any state into ⟨U, D, L², R², F², B²⟩, then finishes inside it. The God\'s-number proof is built on the same subgroup.' },
  },
];
