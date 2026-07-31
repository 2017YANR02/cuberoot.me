import type { Question } from './types';

// 纪录与赛事 —— 纪录分几级、比赛怎么组织。刻意不问「现在的世界纪录是多少」,
// 那类题目每隔几个月就会过期。
export const RECORDS: Question[] = [
  {
    id: 'rec-01', cat: 'records', type: 'choice',
    q: { zh: 'WCA 承认哪几级纪录?', en: 'Which levels of record does the WCA recognise?' },
    options: [
      { zh: '国家/地区纪录、大洲纪录、世界纪录', en: 'National, continental and world records' },
      { zh: '只有世界纪录', en: 'World records only' },
      { zh: '省纪录、国家纪录、世界纪录', en: 'Provincial, national and world records' },
      { zh: '个人纪录和世界纪录', en: 'Personal and world records' },
    ],
    answer: 0,
    why: { zh: '所以你会看到 NR、CR、WR 三种标记(亚洲纪录写作 AsR)。', en: 'Hence the NR, CR and WR markers you see on result pages (AsR for Asian records).' },
  },
  {
    id: 'rec-02', cat: 'records', type: 'choice',
    q: { zh: '同一轮里连续三次刷新了纪录,官方认哪一个?', en: 'You break the record three times in one round. Which one is recognised?' },
    options: [
      { zh: '只认最好的那一个', en: 'Only the best of them' },
      { zh: '三个都算', en: 'All three' },
      { zh: '认第一个', en: 'The first one' },
      { zh: '认最后一个', en: 'The last one' },
    ],
    answer: 0,
    why: { zh: '规则 9i2:同一轮的纪录都算在这一轮的最后一天,一天内只认最好的那次。', en: 'Regulation 9i2 — records in a round all count on its last day, and only the best counts.' },
  },
  {
    id: 'rec-03', cat: 'records', type: 'choice',
    q: { zh: '成绩正好和现有纪录打平,算破纪录吗?', en: 'You exactly tie the existing record. Does that count?' },
    options: [
      { zh: '算,等于或优于都认', en: 'Yes — equalling it counts too' },
      { zh: '不算,必须更快', en: 'No, you must be faster' },
      { zh: '看项目', en: 'Depends on the event' },
      { zh: '要 WCA 代表批准', en: 'Only if the WCA Delegate approves' },
    ],
    answer: 0,
    why: { zh: '规则 9i1a:成绩等于或优于现有纪录即可认定。', en: 'Regulation 9i1a — a result equal to or better than the record is recognised.' },
  },
  {
    id: 'rec-04', cat: 'records', type: 'choice',
    q: { zh: '某个项目的规则改了,以前的纪录怎么办?', en: 'The rules for an event change. What happens to the old records?' },
    options: [
      { zh: '保留,直到在新规则下被打破', en: 'They stand until beaten under the new rules' },
      { zh: '立刻作废', en: 'They are void immediately' },
      { zh: '打个折扣继续算', en: 'They are adjusted with a correction factor' },
      { zh: '移到「非官方纪录」里', en: 'They move to an unofficial list' },
    ],
    answer: 0,
    why: { zh: '规则 9i3。', en: 'Regulation 9i3.' },
  },
  {
    id: 'rec-05', cat: 'records', type: 'open',
    q: { zh: '一场比赛要算 WCA 官方比赛,必须有哪个角色到场?', en: 'What official must be present for a competition to count as a WCA competition?' },
    answer: { zh: 'WCA 代表(Delegate)', en: 'A WCA Delegate' },
    accept: ['代表', 'delegate'],
    why: { zh: '规则 1a:必须有一位 WCA 代表,外加裁判、打乱员、录入员组成的主办团队。', en: 'Regulation 1a — a WCA Delegate plus an organisation team of judges, scramblers and data entry staff.' },
  },
  {
    id: 'rec-06', cat: 'records', type: 'choice',
    q: { zh: '比赛现场的「打乱员」负责什么?', en: 'What does a scrambler do?' },
    options: [
      { zh: '照着官方打乱公式把魔方拧乱并签名确认', en: 'Applies the official scramble sequence and signs it off' },
      { zh: '给选手计时', en: 'Times the competitors' },
      { zh: '录入成绩', en: 'Enters the results' },
      { zh: '检查魔方是不是违规', en: 'Checks puzzles for rule violations' },
    ],
    answer: 0,
  },
  {
    id: 'rec-07', cat: 'records', type: 'choice',
    q: { zh: '同一组的选手拿到的打乱一样吗?', en: 'Do competitors in the same group get the same scrambles?' },
    options: [
      { zh: '一样,所以要严格保密到轮次结束', en: 'Yes — which is why they stay secret until the group is finished' },
      { zh: '每人都不一样', en: 'Everyone gets different ones' },
      { zh: '只有决赛一样', en: 'Only in the final' },
      { zh: '随打乱员心情', en: 'Up to the scrambler' },
    ],
    answer: 0,
    why: { zh: '这也是为什么选手在自己拧完之前不能看别人的还原、不能进打乱区。', en: 'That is also why you may not watch others solve, or enter the scrambling area, before your own attempt.' },
  },
  {
    id: 'rec-08', cat: 'records', type: 'choice',
    q: { zh: '18 岁以下的选手报名比赛需要什么?', en: 'What does a competitor under 18 need in order to register?' },
    options: [
      { zh: '家长或监护人同意', en: 'Permission from a parent or guardian' },
      { zh: '学校证明', en: 'A letter from their school' },
      { zh: '不需要额外条件', en: 'Nothing extra' },
      { zh: '一名成年选手陪同比赛', en: 'An adult competitor to accompany them' },
    ],
    answer: 0,
    why: { zh: '规则 2b。', en: 'Regulation 2b.' },
  },
  {
    id: 'rec-09', cat: 'records', type: 'choice',
    q: { zh: '选手代表的国家/地区是按什么定的?', en: 'How is the country a competitor represents decided?' },
    options: [
      { zh: '按国籍(公民权),首次参赛时确认', en: 'By citizenship, confirmed at the first competition' },
      { zh: '按现在住哪儿', en: 'By where they currently live' },
      { zh: '自己随便选', en: 'They just pick one' },
      { zh: '按比赛举办地', en: 'By where the competition is held' },
    ],
    answer: 0,
    why: { zh: '规则 2e;有多重国籍可以在首次参赛时选一个,之后更改有间隔限制。', en: 'Regulation 2e — dual citizens choose once at their first competition; later changes have a waiting period.' },
  },
  {
    id: 'rec-10', cat: 'records', type: 'choice',
    q: { zh: '下面哪样东西比赛时禁止在还原中使用?', en: 'Which of these is banned during an attempt?' },
    options: [
      { zh: '入耳式耳机', en: 'In-ear earphones' },
      { zh: '眼镜', en: 'Glasses' },
      { zh: '暖手宝', en: 'A hand warmer' },
      { zh: '水杯', en: 'A drink' },
    ],
    answer: 0,
    why: { zh: '规则 2i:能给选手放音频、裁判又听不到的设备一律禁止,哪怕是关着的。', en: 'Regulation 2i — anything that could play audio only the competitor hears is banned, even switched off.' },
  },
  {
    id: 'rec-11', cat: 'records', type: 'choice',
    q: { zh: '对裁判的判罚不服气,该怎么办?', en: 'You disagree with a ruling. What do you do?' },
    options: [
      { zh: '当场找 WCA 代表申诉,他的裁决为最终裁决', en: 'Raise it with the WCA Delegate at the competition; their decision is final' },
      { zh: '直接要求重拧一次', en: 'Demand another attempt' },
      { zh: '比完赛发帖投票', en: 'Post about it afterwards and let people vote' },
      { zh: '找对手协商', en: 'Negotiate with your opponent' },
    ],
    answer: 0,
    why: { zh: '规则 2n:争辩要在争议发生后 30 分钟内、且在该项目下一轮开始前提出。', en: 'Regulation 2n — disputes must be raised within 30 minutes and before the next round of that event.' },
  },
];
