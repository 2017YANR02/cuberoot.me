import type { Question } from './types';

// 规则与判罚 —— 只挑「上过赛场就知道」的那几条,冷门条款不进题库。
// 依据是站内 WCA 规则全文(app/[lang]/regulation),条款号写在解析里方便自查。
export const RULES: Question[] = [
  {
    id: 'rule-01', cat: 'rules', type: 'choice',
    q: { zh: '正式比赛里,三阶还原前的观察时间上限是多久?', en: 'How long may you inspect the cube before a 3×3 attempt?' },
    options: [
      { zh: '15 秒', en: '15 seconds' },
      { zh: '10 秒', en: '10 seconds' },
      { zh: '20 秒', en: '20 seconds' },
      { zh: '不限时', en: 'No limit' },
    ],
    answer: 0,
    why: { zh: '规则 A3a1:观察最多 15 秒,之后必须开始还原。', en: 'Regulation A3a1 — up to 15 seconds of inspection.' },
  },
  {
    id: 'rule-02', cat: 'rules', type: 'choice',
    q: { zh: '观察时裁判会在哪两个时间点报数?', en: 'At which two moments does the judge call out during inspection?' },
    options: [
      { zh: '8 秒和 12 秒', en: '8 seconds and 12 seconds' },
      { zh: '5 秒和 10 秒', en: '5 and 10 seconds' },
      { zh: '10 秒和 14 秒', en: '10 and 14 seconds' },
      { zh: '只在 15 秒时报一次', en: 'Only once, at 15 seconds' },
    ],
    answer: 0,
    why: { zh: '规则 A3b3 / A3b4:裁判喊「8 秒」和「12 秒」提醒。', en: 'Regulations A3b3 and A3b4 — the judge calls "8 seconds" then "12 seconds".' },
  },
  {
    id: 'rule-03', cat: 'rules', type: 'open',
    q: { zh: '「+2」这个判罚是什么意思?', en: 'What does a "+2" penalty mean?' },
    answer: { zh: '在成绩上加罚 2 秒', en: 'Two seconds are added to the result' },
    accept: ['加 2', '加2', '加罚', '2 秒', '2秒', 'two second', '+2 s', 'add 2', 'plus 2'],
  },
  {
    id: 'rule-04', cat: 'rules', type: 'choice',
    q: { zh: '观察超时了(超过 15 秒才开始还原)会怎么判?', en: 'You start solving after more than 15 seconds of inspection. What happens?' },
    options: [
      { zh: '加罚 2 秒', en: '+2 seconds' },
      { zh: '直接 DNF', en: 'Straight DNF' },
      { zh: '没有惩罚', en: 'No penalty' },
      { zh: '重新给一次机会', en: 'You get a fresh attempt' },
    ],
    answer: 0,
    why: { zh: '规则 A4d1:超过 15 秒 +2;拖到超过 17 秒才动手,才会判 DNF。', en: 'A4d1 — over 15s is +2. Only past 17 seconds does it become a DNF.' },
  },
  {
    id: 'rule-05', cat: 'rules', type: 'choice',
    q: { zh: '观察阶段可以做下面哪件事?', en: 'Which of these may you do during inspection?' },
    options: [
      { zh: '拿起魔方翻来覆去地看', en: 'Pick the cube up and turn it around to look at it' },
      { zh: '转一层再转回来', en: 'Turn a layer and turn it back' },
      { zh: '看一眼自己写的公式笔记', en: 'Glance at your own notes' },
      { zh: '戴着耳机听音乐', en: 'Listen to music with earphones' },
    ],
    answer: 0,
    why: { zh: '可以拿起来看,但禁止转动魔方(规则 A3c1),笔记和入耳耳机也一律不许用。', en: 'You may hold and rotate the whole cube, but not turn any layer (A3c1). Notes and earphones are banned.' },
  },
  {
    id: 'rule-06', cat: 'rules', type: 'choice',
    q: { zh: '停止计时器时手该怎么放?', en: 'How must you stop the timer?' },
    options: [
      { zh: '双手手掌向下同时按下', en: 'Both hands, palms down, at the same time' },
      { zh: '随便一只手拍一下', en: 'Slap it with either hand' },
      { zh: '用魔方按下去', en: 'Press it with the cube' },
      { zh: '喊一声让裁判按', en: 'Shout so the judge can stop it' },
    ],
    answer: 0,
    why: { zh: '规则 A6d:必须双手掌心向下停表,单手停表要 +2。', en: 'A6d — both hands, palms down. A one-handed stop costs +2.' },
  },
  {
    id: 'rule-07', cat: 'rules', type: 'choice',
    q: { zh: '停表以后才发现魔方还差一步,怎么判?', en: 'You stop the timer and only then notice the cube is one move off. What now?' },
    options: [
      { zh: '不能再碰,由裁判判定(通常是 DNF)', en: 'Hands off — the judge decides, and it is normally a DNF' },
      { zh: '赶紧补上那一步就算还原', en: 'Quickly finish that move and it counts as solved' },
      { zh: '加罚 2 秒后算还原', en: 'It counts as solved with +2' },
      { zh: '重新计时再来一次', en: 'Restart the timer and try again' },
    ],
    answer: 0,
    why: { zh: '规则 A6e:停表后不得再转动魔方,转了就是 DNF。', en: 'A6e — turning the puzzle after stopping the timer means DNF.' },
  },
  {
    id: 'rule-08', cat: 'rules', type: 'choice',
    q: { zh: '停表时最后一层稍微没对齐(偏了一点点),会怎么判?', en: 'The last layer is slightly misaligned when you stop the timer. What happens?' },
    options: [
      { zh: '偏差在 45 度以内就算还原,不加罚', en: 'Within 45° it still counts as solved, no penalty' },
      { zh: '一定 DNF', en: 'Always a DNF' },
      { zh: '一定 +2', en: 'Always +2' },
      { zh: '看裁判心情', en: 'Up to the judge' },
    ],
    answer: 0,
    why: { zh: '规则 10f1:N 阶魔方的错位限度是 45 度,以内视为还原。', en: 'Regulation 10f1 — for NxN puzzles the misalignment limit is 45 degrees.' },
  },
  {
    id: 'rule-09', cat: 'rules', type: 'choice',
    q: { zh: '计时器显示 12.678,成绩单上记多少?', en: 'The timer reads 12.678. What goes on the score sheet?' },
    options: [
      { zh: '12.67', en: '12.67' },
      { zh: '12.68', en: '12.68' },
      { zh: '12.7', en: '12.7' },
      { zh: '12.678', en: '12.678' },
    ],
    answer: 0,
    why: { zh: '规则 9f1:十分钟以内的单次成绩一律向下取整到百分秒,不四舍五入。', en: 'Regulation 9f1 — single results under ten minutes are truncated to hundredths, never rounded up.' },
  },
  {
    id: 'rule-10', cat: 'rules', type: 'open',
    q: { zh: '「5 次去尾平均」是怎么算出来的?', en: 'How is an "average of 5" calculated?' },
    answer: { zh: '5 次里去掉最好和最坏,剩下 3 次取平均', en: 'Drop the best and the worst of the five, then average the remaining three' },
    accept: ['去掉最好', '去掉最快', '去头去尾', '掉最好', 'drop the best', 'remove best', 'middle three', '中间三', '中间 3'],
  },
  {
    id: 'rule-11', cat: 'rules', type: 'choice',
    q: { zh: '一轮 5 次里出现两个 DNF,平均成绩记什么?', en: 'Two of your five attempts are DNF. What is your average?' },
    options: [
      { zh: 'DNF', en: 'DNF' },
      { zh: '按剩下 3 次算平均', en: 'The average of the other three' },
      { zh: '按最差成绩 ×2 计', en: 'Twice your worst time' },
      { zh: '不记录成绩', en: 'No result recorded' },
    ],
    answer: 0,
    why: { zh: '规则 9f9:一个 DNF 可以当最坏成绩去掉,两个就没法去了,平均判 DNF。', en: 'Regulation 9f9 — one DNF can be dropped as the worst result, two cannot, so the average is DNF.' },
  },
  {
    id: 'rule-12', cat: 'rules', type: 'choice',
    q: { zh: '「DNF」和「DNS」的区别是什么?', en: 'What is the difference between DNF and DNS?' },
    options: [
      { zh: 'DNF 是拧了但没还原/被取消,DNS 是根本没开始', en: 'DNF means attempted but not solved (or disqualified); DNS means never started' },
      { zh: 'DNF 是超时,DNS 是弃权', en: 'DNF means out of time, DNS means forfeit' },
      { zh: '两个一样,只是新旧写法', en: 'They are the same thing, old and new spelling' },
      { zh: 'DNF 用于单次,DNS 用于平均', en: 'DNF is for singles, DNS is for averages' },
    ],
    answer: 0,
    why: { zh: 'Did Not Finish / Did Not Start(规则 9f4、9f5)。', en: 'Did Not Finish / Did Not Start (Regulations 9f4 and 9f5).' },
  },
  {
    id: 'rule-13', cat: 'rules', type: 'choice',
    q: { zh: '每次还原结束后,成绩单上要谁签名?', en: 'Who signs the score sheet after each attempt?' },
    options: [
      { zh: '选手和裁判都要签', en: 'Both the competitor and the judge' },
      { zh: '只要裁判签', en: 'The judge only' },
      { zh: '只要选手签', en: 'The competitor only' },
      { zh: '谁都不用签', en: 'Nobody needs to sign' },
    ],
    answer: 0,
    why: { zh: '规则 A7b / A7c:两人各自签名确认成绩;选手漏签会被判 DNF。', en: 'A7b and A7c — both sign to confirm the result; a missing competitor signature means DNF.' },
  },
  {
    id: 'rule-14', cat: 'rules', type: 'choice',
    q: { zh: '打乱好的魔方在你观察之前会怎么处理?', en: 'What happens to a scrambled puzzle before your inspection starts?' },
    options: [
      { zh: '盖起来,不让任何人看见', en: 'It is covered so nobody can see it' },
      { zh: '摆在桌上任人参观', en: 'It sits on the table in plain view' },
      { zh: '交给选手先拿着', en: 'It is handed to the competitor to hold' },
      { zh: '拍照存档后放好', en: 'It is photographed for the record' },
    ],
    answer: 0,
    why: { zh: '规则 A2c1:打乱后必须用盖子遮住,直到还原开始。', en: 'A2c1 — the scrambled puzzle stays covered until the solve begins.' },
  },
  {
    id: 'rule-15', cat: 'rules', type: 'choice',
    q: { zh: '比赛时能自己挑魔方放在垫子上的朝向吗?', en: 'Can you ask for a particular orientation of the puzzle on the mat?' },
    options: [
      { zh: '不能,裁判随便放', en: 'No — the judge places it in any orientation' },
      { zh: '能,可以要求白面朝上', en: 'Yes, you may ask for white on top' },
      { zh: '能,自己动手摆', en: 'Yes, you place it yourself' },
      { zh: '看项目,三阶可以', en: 'Depends on the event; allowed for 3×3' },
    ],
    answer: 0,
    why: { zh: '规则 A2e1:选手无权要求特定朝向,裁判也不能按自己意愿摆。', en: 'A2e1 — competitors may not request an orientation, and judges must not bias it either.' },
  },
];
