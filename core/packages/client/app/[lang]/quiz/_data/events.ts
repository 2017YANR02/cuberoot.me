import type { Question } from './types';

// 项目与赛制 —— WCA 十七个项目长什么样、怎么算成绩。
export const EVENTS: Question[] = [
  {
    id: 'evt-01', cat: 'events', type: 'choice',
    q: { zh: '现在 WCA 一共有多少个官方项目?', en: 'How many official WCA events are there today?' },
    options: [
      { zh: '17 个', en: '17' },
      { zh: '12 个', en: '12' },
      { zh: '21 个', en: '21' },
      { zh: '9 个', en: '9' },
    ],
    answer: 0,
    why: { zh: '二到七阶、三阶单手、盲拧三项、最少步、多盲,加魔表、五魔方、金字塔、斜转、Square-1。', en: '2×2 to 7×7, one-handed, three blindfolded events, fewest moves, multi-blind, plus Clock, Megaminx, Pyraminx, Skewb and Square-1.' },
  },
  {
    id: 'evt-02', cat: 'events', type: 'choice',
    q: { zh: '下面哪个已经不是 WCA 官方项目了?', en: 'Which of these is no longer an official WCA event?' },
    options: [
      { zh: '三阶脚拧', en: '3×3 with feet' },
      { zh: '魔表', en: 'Clock' },
      { zh: '斜转', en: 'Skewb' },
      { zh: 'Square-1', en: 'Square-1' },
    ],
    answer: 0,
    why: { zh: '脚拧从 2020 年起退役,原因是参与人数太少。', en: '3×3 with feet was retired at the start of 2020 — too few competitors.' },
  },
  {
    id: 'evt-03', cat: 'events', type: 'choice',
    q: { zh: '三阶一轮打几次、按什么排名?', en: 'How many attempts per 3×3 round, and how is it ranked?' },
    options: [
      { zh: '5 次,按去尾平均排名', en: 'Five attempts, ranked by average of 5' },
      { zh: '3 次,按平均排名', en: 'Three attempts, ranked by mean' },
      { zh: '5 次,按最快单次排名', en: 'Five attempts, ranked by best single' },
      { zh: '1 次决胜', en: 'A single attempt' },
    ],
    answer: 0,
  },
  {
    id: 'evt-04', cat: 'events', type: 'choice',
    q: { zh: '六阶、七阶一轮打几次?', en: 'How many attempts per round for 6×6 and 7×7?' },
    options: [
      { zh: '3 次,取平均', en: 'Three, averaged' },
      { zh: '5 次,取去尾平均', en: 'Five, average of 5' },
      { zh: '2 次,取最快', en: 'Two, best of' },
      { zh: '1 次', en: 'One' },
    ],
    answer: 0,
    why: { zh: '大阶魔方太耗时,用「3 次取平均」(不去尾)。', en: 'Big cubes take too long, so they use a mean of 3 with nothing dropped.' },
  },
  {
    id: 'evt-05', cat: 'events', type: 'choice',
    q: { zh: '三阶盲拧一轮按什么排名?', en: 'How is a 3×3 blindfolded round ranked?' },
    options: [
      { zh: '取最好的那一次单次成绩', en: 'By the best single attempt' },
      { zh: '取去尾平均', en: 'By an average of 5' },
      { zh: '取 3 次平均', en: 'By a mean of 3' },
      { zh: '按几次尝试的总时间', en: 'By the total time of all attempts' },
    ],
    answer: 0,
    why: { zh: '盲拧失败率高,所以看最好的那一次(完整轮次是 5 次取最快)。WCA 另外也统计它的平均排名。', en: 'Blindfolded solves fail often, so only the best attempt counts (a full round is best of 5). The WCA also tracks a separate average ranking.' },
  },
  {
    id: 'evt-06', cat: 'events', type: 'choice',
    q: { zh: '盲拧项目里,记忆的时间算在成绩里吗?', en: 'In blindfolded events, does memorisation time count towards the result?' },
    options: [
      { zh: '算,记忆和还原一起计时', en: 'Yes — memorisation and solving are timed together' },
      { zh: '不算,记忆时间单独扣掉', en: 'No, it is subtracted' },
      { zh: '算一半', en: 'Half of it counts' },
      { zh: '看比赛规模', en: 'Depends on the competition' },
    ],
    answer: 0,
    why: { zh: '盲拧没有单独的观察阶段,一按表就开始记忆,全程算成绩。', en: 'There is no separate inspection: the clock starts, you memorise, and it all counts.' },
  },
  {
    id: 'evt-07', cat: 'events', type: 'choice',
    q: { zh: '三阶最少步(FMC)的成绩单位是什么?', en: 'What unit is a Fewest Moves result measured in?' },
    options: [
      { zh: '步数', en: 'Number of moves' },
      { zh: '秒', en: 'Seconds' },
      { zh: '分钟', en: 'Minutes' },
      { zh: '还原的面数', en: 'Number of solved faces' },
    ],
    answer: 0,
    why: { zh: '给你一张纸、一个魔方和一小时,写出尽量短的解法;成绩就是那个步数。', en: 'You get paper, a cube and an hour to write the shortest solution you can — the move count is your result.' },
  },
  {
    id: 'evt-08', cat: 'events', type: 'choice',
    q: { zh: '三阶多盲比的是什么?', en: 'What do you do in 3×3 multi-blind?' },
    options: [
      { zh: '蒙眼一次记住并还原尽量多个魔方', en: 'Memorise and solve as many cubes as you can, blindfolded, in one go' },
      { zh: '蒙眼还原多种不同的魔方', en: 'Solve several different puzzles blindfolded' },
      { zh: '多人同时蒙眼比拼', en: 'Several people solve blindfolded at once' },
      { zh: '蒙眼还原同一个魔方多次', en: 'Solve the same cube blindfolded several times' },
    ],
    answer: 0,
  },
  {
    id: 'evt-09', cat: 'events', type: 'choice',
    q: { zh: '多盲成绩「3/5 40:30」是什么意思?', en: 'What does a multi-blind result of "3/5 40:30" mean?' },
    options: [
      { zh: '5 个里还原了 3 个,用了 40 分 30 秒', en: 'Three of five cubes solved, in 40 minutes 30 seconds' },
      { zh: '3 组 5 个,总共 40 分 30 秒', en: 'Three sets of five, 40:30 in total' },
      { zh: '第 3 次尝试还原 5 个', en: 'The third attempt solved five cubes' },
      { zh: '5 个魔方平均 40.3 秒', en: 'Five cubes averaging 40.3 seconds' },
    ],
    answer: 0,
  },
  {
    id: 'evt-10', cat: 'events', type: 'choice',
    q: { zh: '五魔方(Megaminx)有多少个面?', en: 'How many faces does a Megaminx have?' },
    options: [
      { zh: '12 个', en: '12' },
      { zh: '10 个', en: '10' },
      { zh: '6 个', en: '6' },
      { zh: '20 个', en: '20' },
    ],
    answer: 0,
    why: { zh: '正十二面体,每面是正五边形。', en: 'It is a dodecahedron — twelve pentagonal faces.' },
  },
  {
    id: 'evt-11', cat: 'events', type: 'choice',
    q: { zh: '金字塔(Pyraminx)是什么形状?', en: 'What shape is a Pyraminx?' },
    options: [
      { zh: '正四面体', en: 'A tetrahedron' },
      { zh: '正八面体', en: 'An octahedron' },
      { zh: '四棱锥', en: 'A square pyramid' },
      { zh: '圆锥', en: 'A cone' },
    ],
    answer: 0,
  },
  {
    id: 'evt-12', cat: 'events', type: 'choice',
    q: { zh: 'Square-1 最特别的地方是什么?', en: 'What makes Square-1 unusual?' },
    options: [
      { zh: '转动会改变整体形状,不再是方块', en: 'Turning it changes its overall shape — it stops being a cube' },
      { zh: '没有中心块', en: 'It has no centre pieces' },
      { zh: '只有两种颜色', en: 'It only has two colours' },
      { zh: '要用磁铁吸住才转得动', en: 'It only turns when magnets hold it' },
    ],
    answer: 0,
    why: { zh: '所以还原它得先「归形」,再排颜色。', en: 'That is why solving it starts with getting back to cube shape, then sorting colours.' },
  },
  {
    id: 'evt-13', cat: 'events', type: 'choice',
    q: { zh: '魔表(Clock)每面有几个钟盘?', en: 'How many dials does each side of a Rubik\'s Clock have?' },
    options: [
      { zh: '9 个', en: '9' },
      { zh: '4 个', en: '4' },
      { zh: '6 个', en: '6' },
      { zh: '12 个', en: '12' },
    ],
    answer: 0,
    why: { zh: '两面各 9 个,共 18 个钟盘,靠 4 个插销切换联动方式;目标是两面全部指到 12 点。', en: 'Nine per side, eighteen in total, driven through four pins. The goal is every dial at 12 on both sides.' },
  },
  {
    id: 'evt-14', cat: 'events', type: 'choice',
    q: { zh: '三阶单手项目里,另一只手能碰魔方吗?', en: 'In one-handed solving, may the other hand touch the cube?' },
    options: [
      { zh: '不能碰', en: 'No' },
      { zh: '可以扶一下', en: 'Yes, to steady it' },
      { zh: '换手可以但只能一次', en: 'You may switch hands once' },
      { zh: '掉地上时可以', en: 'Only to pick it up off the floor' },
    ],
    answer: 0,
    why: { zh: '全程只能用一只手,桌面可以借力,但另一只手不许参与。', en: 'One hand for the whole solve. The table may help, the other hand may not.' },
  },
];
