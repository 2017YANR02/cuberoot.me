import type { Question } from '../types';

// 进阶 纪录与赛事 —— 赛制细节、纪录认定、打乱出错怎么收场。
export const RECORDS_HARD: Question[] = [
  {
    id: 'rec-h01', cat: 'records', type: 'choice',
    q: { zh: '三阶盲拧的完整轮次是几次尝试?', en: 'A full 3×3 blindfolded round consists of how many attempts?' },
    options: [
      { zh: '5 次,取最快', en: 'Five, best of' },
      { zh: '3 次,取最快', en: 'Three, best of' },
      { zh: '5 次,去尾平均', en: 'Five, average of' },
      { zh: '3 次,取平均', en: 'Three, mean of' },
    ],
    answer: 0,
    why: { zh: '规则 9b3a。实际比赛常设及格线,所以你多半只见过打 3 次的场面。', en: 'Regulation 9b3a. Most competitions run it as a combined round, which is why three attempts is the familiar sight.' },
  },
  {
    id: 'rec-h02', cat: 'records', type: 'choice',
    q: { zh: '四阶盲拧、五阶盲拧的完整轮次是几次?', en: 'How many attempts in a full 4×4 or 5×5 blindfolded round?' },
    options: [
      { zh: '3 次,取最快', en: 'Three, best of' },
      { zh: '5 次,取最快', en: 'Five, best of' },
      { zh: '2 次', en: 'Two' },
      { zh: '1 次', en: 'One' },
    ],
    answer: 0,
    why: { zh: '规则 9b6a。', en: 'Regulation 9b6a.' },
  },
  {
    id: 'rec-h03', cat: 'records', type: 'choice',
    q: { zh: '哪些项目除了官方赛制,WCA 还额外承认一套「平均」排名?', en: 'For which events does the WCA also recognise an extra "average" ranking outside the round format?' },
    options: [
      { zh: '三阶盲拧(去尾平均)和四五阶盲拧(3 次平均)', en: '3×3 blindfolded (average of 5) and 4×4 / 5×5 blindfolded (mean of 3)' },
      { zh: '最少步和多盲', en: 'Fewest moves and multi-blind' },
      { zh: '六阶和七阶', en: '6×6 and 7×7' },
      { zh: '没有这种情况', en: 'No event has one' },
    ],
    answer: 0,
    why: { zh: '规则 9b3b / 9b6b:这些平均只进排名和纪录,不影响该轮次的名次(轮次照旧看最好单次)。', en: 'Regulations 9b3b and 9b6b — those averages feed rankings and records only; the round is still ranked by best single.' },
  },
  {
    id: 'rec-h04', cat: 'records', type: 'choice',
    q: { zh: '「一对一」赛制只能用在哪些项目?', en: 'Which events may use the head-to-head format?' },
    options: [
      { zh: '三阶、四阶、三阶盲拧和三阶单手', en: '3×3, 4×4, 3×3 blindfolded and one-handed' },
      { zh: '所有项目', en: 'All events' },
      { zh: '只有三阶', en: '3×3 only' },
      { zh: '只有金字塔和斜转', en: 'Pyraminx and Skewb only' },
    ],
    answer: 0,
    why: { zh: '规则 9b7a,而且只能用在决赛(9b7b)。', en: 'Regulation 9b7a, and only in a final (9b7b).' },
  },
  {
    id: 'rec-h05', cat: 'records', type: 'choice',
    q: { zh: '「一对一」轮次里能产生什么纪录?', en: 'What records can come out of a head-to-head round?' },
    options: [
      { zh: '只有单次成绩能进排名破纪录,不产生平均', en: 'Singles only — they rank and break records; no average is produced' },
      { zh: '单次和平均都算', en: 'Both singles and averages' },
      { zh: '什么都不算,只决胜负', en: 'Neither — it only decides the match' },
      { zh: '只有平均算', en: 'Averages only' },
    ],
    answer: 0,
    why: { zh: '规则 9i4。', en: 'Regulation 9i4.' },
  },
  {
    id: 'rec-h06', cat: 'records', type: 'choice',
    q: { zh: '「一对一」轮次里被淘汰的选手怎么排名?', en: 'How are eliminated competitors ranked in a head-to-head round?' },
    options: [
      { zh: '按进入的最高阶段,同阶段内比最佳单次', en: 'By the furthest stage reached, then by best single within that stage' },
      { zh: '按报名成绩', en: 'By their registration times' },
      { zh: '一律并列', en: 'All tied' },
      { zh: '按上一轮成绩', en: 'By the previous round' },
    ],
    answer: 0,
    why: { zh: '规则 9f16b:决赛胜者第一、负者第二,还有三四名决赛。', en: 'Regulation 9f16b — winner first, loser second, plus a third-place match.' },
  },
  {
    id: 'rec-h07', cat: 'records', type: 'choice',
    q: { zh: '十分钟及以上的成绩怎么取整?', en: 'How are results of ten minutes or more rounded?' },
    options: [
      { zh: '向下取整到秒', en: 'Truncated to whole seconds' },
      { zh: '向下取整到百分秒', en: 'Truncated to hundredths' },
      { zh: '四舍五入到秒', en: 'Rounded to the nearest second' },
      { zh: '保留原样', en: 'Kept as displayed' },
    ],
    answer: 0,
    why: { zh: '规则 9f2:多盲成绩也一样按秒记。平均/去尾平均超过十分钟的才四舍五入到秒。', en: 'Regulation 9f2, and multi-blind times too. Only averages over ten minutes get rounded rather than truncated.' },
  },
  {
    id: 'rec-h08', cat: 'records', type: 'choice',
    q: { zh: '还原完才发现魔方打乱错了,一般怎么处理?', en: 'A cube turns out to have been mis-scrambled, discovered after the solve. What normally happens?' },
    options: [
      { zh: '成绩通常保留,除非明显更不公平或涉及纪录/领奖台', en: 'The result usually stands, unless it is clearly unfair or touches a record or the podium' },
      { zh: '一律判 DNF', en: 'Always a DNF' },
      { zh: '一律给额外尝试', en: 'Always an extra attempt' },
      { zh: '整组重打', en: 'The whole group re-solves' },
    ],
    answer: 0,
    why: { zh: '规则 11i:涉及地区纪录、世界前 50 选手的个人纪录等情形必须用额外尝试替换。', en: 'Regulation 11i — an extra attempt is mandatory when a regional record or a top-50 competitor\'s personal best is involved.' },
  },
  {
    id: 'rec-h09', cat: 'records', type: 'choice',
    q: { zh: '选手拿到一个自己已经见过的打乱(重复打乱),赛后才发现怎么办?', en: 'A competitor got a scramble they had already seen, and it is only found after the competition. Then what?' },
    options: [
      { zh: '该成绩记为 DNS', en: 'The result is recorded as DNS' },
      { zh: '成绩保留', en: 'The result stands' },
      { zh: '记为 DNF', en: 'It becomes a DNF' },
      { zh: '整轮作废', en: 'The whole round is voided' },
    ],
    answer: 0,
    why: { zh: '规则 11j4。比赛期间发现的话,应尽量补一次额外尝试。', en: 'Regulation 11j4. Caught during the competition, it is replaced with an extra attempt instead.' },
  },
  {
    id: 'rec-h10', cat: 'records', type: 'choice',
    q: { zh: '一轮只拧出 DNF 的选手能晋级下一轮吗?', en: 'Can a competitor whose round produced only DNFs advance?' },
    options: [
      { zh: '不能', en: 'No' },
      { zh: '能,只要名次够', en: 'Yes, if their placing is high enough' },
      { zh: '能,由代表决定', en: 'Yes, at the Delegate\'s discretion' },
      { zh: '只有决赛不能', en: 'Only barred from finals' },
    ],
    answer: 0,
    why: { zh: '规则 9p4:只有 DNF 和/或 DNS 的选手没有晋级资格。', en: 'Regulation 9p4 — DNF/DNS-only results carry no qualification.' },
  },
  {
    id: 'rec-h11', cat: 'records', type: 'choice',
    q: { zh: '谁要在成绩单上签名,确认这个打乱执行正确?', en: 'Who signs the score sheet to confirm a scramble was applied correctly?' },
    options: [
      { zh: '打乱员(或被授权的裁判)', en: 'The scrambler, or an authorised judge' },
      { zh: 'WCA 代表', en: 'The WCA Delegate' },
      { zh: '选手自己', en: 'The competitor' },
      { zh: '录入员', en: 'The data entry staff' },
    ],
    answer: 0,
    why: { zh: '规则 A2d1:五阶及以上和五魔方例外 —— 那些只签「已充分打乱」。', en: 'Regulation A2d1 — for 5×5 and above plus Megaminx, the signature only confirms it was sufficiently scrambled.' },
  },
  {
    id: 'rec-h12', cat: 'records', type: 'choice',
    q: { zh: '同一轮里的纪录按哪一天算?', en: 'Records set in a round are dated to which day?' },
    options: [
      { zh: '该轮最后一天,以赛场当地时间为准', en: 'The last day of that round, in local time at the venue' },
      { zh: '成绩产生的那一刻', en: 'The exact moment they were set' },
      { zh: '比赛的第一天', en: 'The first day of the competition' },
      { zh: '成绩上传的那天', en: 'The day results were uploaded' },
    ],
    answer: 0,
    why: { zh: '规则 9i2。所以同一天多次刷新,只认最好的那一个。', en: 'Regulation 9i2 — so if you beat it several times in a day, only the best counts.' },
  },
];
