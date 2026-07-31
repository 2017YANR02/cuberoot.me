import type { Question } from '../types';

// 进阶 装备与故障 —— 魔方合规性、散架怎么修、掉块算不算还原。
export const GEAR_HARD: Question[] = [
  {
    id: 'ger-h01', cat: 'gear', type: 'choice',
    q: { zh: '盲拧用的魔方为什么不能有纹理或标记?', en: 'Why may a blindfolded solver\'s cube have no texture or markings?' },
    options: [
      { zh: '摸得出来就等于作弊,块的身份不能靠手感辨认', en: 'Feeling them would identify pieces by touch — that counts as an unfair aid' },
      { zh: '纹理会影响手速', en: 'Texture slows the turning down' },
      { zh: '会磨坏眼罩', en: 'It wears out the blindfold' },
      { zh: '规则只是为了统一外观', en: 'The rule is purely cosmetic' },
    ],
    answer: 0,
    why: { zh: '规则 3k / B1+。例外只有三阶盲拧允许一个符合规则 3l 的 logo。', en: 'Regulations 3k and B1+. The one exception: 3×3 blindfolded allows a single logo meeting Regulation 3l.' },
  },
  {
    id: 'ger-h02', cat: 'gear', type: 'choice',
    q: { zh: '还原中魔方散架了,能用工具或别的块来修吗?', en: 'Your cube falls apart mid-solve. May you use tools or spare pieces to fix it?' },
    options: [
      { zh: '不能,只能手把发生故障的块装回去', en: 'No — only the affected pieces, by hand' },
      { zh: '可以用螺丝刀', en: 'A screwdriver is allowed' },
      { zh: '可以换一个备用魔方', en: 'You may swap in a spare cube' },
      { zh: '可以请裁判帮忙装', en: 'The judge may assemble it for you' },
    ],
    answer: 0,
    why: { zh: '规则 5b1 / 5b2:动到别的块、或者借修理占便宜,一律 DNF。', en: 'Regulations 5b1 and 5b2 — touching other pieces, or gaining any advantage from the repair, is a DNF.' },
  },
  {
    id: 'ger-h03', cat: 'gear', type: 'choice',
    q: { zh: '修好之后发现魔方变成不可还原状态,最多能拆装几个块救回来?', en: 'After a repair the cube turns out unsolvable. How many pieces may you take out and refit?' },
    options: [
      { zh: '最多 4 个', en: 'At most four' },
      { zh: '最多 2 个', en: 'At most two' },
      { zh: '最多 1 个', en: 'Only one' },
      { zh: '不限个数', en: 'As many as needed' },
    ],
    answer: 0,
    why: { zh: '规则 5b3b。', en: 'Regulation 5b3b.' },
  },
  {
    id: 'ger-h04', cat: 'gear', type: 'choice',
    q: { zh: '如果故障只是让一个角块原地转了,怎么处理?', en: 'If a malfunction merely left one corner twisted in place, what may you do?' },
    options: [
      { zh: '直接把它原地转回来,不必拆装', en: 'Twist it back in place — no disassembly needed' },
      { zh: '必须拆下来重装', en: 'You must take it out and refit it' },
      { zh: '只能判 DNF', en: 'It is simply a DNF' },
      { zh: '必须叫裁判处理', en: 'The judge has to handle it' },
    ],
    answer: 0,
    why: { zh: '规则 5b3c:多个角被故障转了也可以一起转回,但纠正的个数不能超过实际被转的个数。', en: 'Regulation 5b3c — several twisted corners may be corrected too, but never more than the malfunction actually twisted.' },
  },
  {
    id: 'ger-h05', cat: 'gear', type: 'choice',
    q: { zh: '停表时高阶魔方掉了一个中心块,算还原吗?', en: 'A big cube finishes with one centre piece out. Solved or not?' },
    options: [
      { zh: '只掉一个单色块 —— 算还原', en: 'A single one-colour piece — still counts as solved' },
      { zh: '一律 DNF', en: 'Always DNF' },
      { zh: '算还原但要 +2', en: 'Solved, with a +2' },
      { zh: '看它掉在哪儿', en: 'Depends where it landed' },
    ],
    answer: 0,
    why: { zh: '规则 5b5:掉一个单色块算还原,两个及以上单色块、或任何一个多色块(比如棱、角)受影响就是 DNF。', en: 'Regulation 5b5 — one single-colour piece is fine; two or more, or any multi-colour piece like an edge or corner, is a DNF.' },
  },
  {
    id: 'ger-h06', cat: 'gear', type: 'choice',
    q: { zh: '五魔方的错位限度是多少度?', en: 'What is the misalignment limit for a Megaminx?' },
    options: [
      { zh: '36 度', en: '36°' },
      { zh: '45 度', en: '45°' },
      { zh: '60 度', en: '60°' },
      { zh: '72 度', en: '72°' },
    ],
    answer: 0,
    why: { zh: '规则 10f2:限度取「相邻两个状态的一半」,五边形一格 72 度,所以是 36 度。', en: 'Regulation 10f2 — the limit is half a click, and a pentagon click is 72°.' },
  },
  {
    id: 'ger-h07', cat: 'gear', type: 'choice',
    q: { zh: '金字塔和斜转的错位限度是多少度?', en: 'And for Pyraminx and Skewb?' },
    options: [
      { zh: '60 度', en: '60°' },
      { zh: '45 度', en: '45°' },
      { zh: '36 度', en: '36°' },
      { zh: '30 度', en: '30°' },
    ],
    answer: 0,
    why: { zh: '规则 10f3:这两个魔方一格是 120 度,一半就是 60 度。', en: 'Regulation 10f3 — a click on either is 120°, so half is 60°.' },
  },
  {
    id: 'ger-h08', cat: 'gear', type: 'choice',
    q: { zh: 'Square-1 的错位限度怎么规定?', en: 'How is Square-1 misalignment limited?' },
    options: [
      { zh: 'U/D 层 45 度,「/」那一下 90 度,而且 X 和 Y 分开算', en: '45° on the U/D layers and 90° on the slash, with X and Y judged separately' },
      { zh: '统一 30 度', en: '30° across the board' },
      { zh: '统一 45 度', en: '45° across the board' },
      { zh: '不设限度', en: 'No limit is set' },
    ],
    answer: 0,
    why: { zh: '规则 10f4:所以 (5,1) 算差 1 步,(5,5) 算差 2 步。', en: 'Regulation 10f4 — so (5,1) is one move away, while (5,5) is two.' },
  },
  {
    id: 'ger-h09', cat: 'gear', type: 'choice',
    q: { zh: 'Square-1 打乱后为什么有时会插一片薄片进去?', en: 'Why is a thin object sometimes wedged into a scrambled Square-1?' },
    options: [
      { zh: '防止打乱好的魔方在开始前被意外转动', en: 'To stop the scrambled puzzle from being turned by accident before the solve' },
      { zh: '标记打乱朝向', en: 'To mark the scramble orientation' },
      { zh: '让它转得更顺', en: 'To make it turn more smoothly' },
      { zh: '防止散架', en: 'To keep it from falling apart' },
    ],
    answer: 0,
    why: { zh: '规则 A2b1:主办团队可以这么做,但必须赛前公告;选手要自己在观察阶段把它取出来。', en: 'Regulation A2b1 — organisers may do this if announced in advance, and you remove it yourself during inspection.' },
  },
  {
    id: 'ger-h10', cat: 'gear', type: 'choice',
    q: { zh: '魔表打乱时怎么摆?', en: 'How is a Rubik\'s Clock oriented for scrambling?' },
    options: [
      { zh: '任意一面朝前,12 点方向朝上', en: 'Either side facing front, with 12 o\'clock up' },
      { zh: '指定的正面朝前,6 点朝上', en: 'The designated front, with 6 o\'clock up' },
      { zh: '针都拨上,任意朝向', en: 'All pins up, any orientation' },
      { zh: '背面朝前', en: 'Back side to the front' },
    ],
    answer: 0,
    why: { zh: '规则 4d4。魔表两面对称,所以「哪面朝前」不重要,12 点朝上才重要。', en: 'Regulation 4d4 — the two sides are symmetric, so only the 12 o\'clock reference matters.' },
  },
  {
    id: 'ger-h11', cat: 'gear', type: 'choice',
    q: { zh: '如果魔方的配色是用黑色代替白色,打乱时哪面朝上?', en: 'A cube uses black in place of white. Which face goes up when scrambling?' },
    options: [
      { zh: '黑色算最暗的颜色,不能当白色用', en: 'Black counts as the darkest colour — it must not stand in for white' },
      { zh: '黑色当白色,朝上', en: 'Black stands in for white and goes up' },
      { zh: '随便哪面朝上', en: 'Any face may go up' },
      { zh: '这种魔方不允许比赛', en: 'Such a cube is not allowed at all' },
    ],
    answer: 0,
    why: { zh: '规则 4d 的澄清:打乱朝向按「最亮的面朝上、最暗的相邻面朝前」判定,黑色只能是那个最暗的。', en: 'The clarification to Regulation 4d — orientation goes by lightest face up, darkest adjacent face front, and black is the darkest.' },
  },
];
