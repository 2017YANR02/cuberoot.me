import type { Question } from './types';

// 历史与人物 —— 发明、早期赛事、WCA 的由来。都是能一句话说清的常识题。
export const HISTORY: Question[] = [
  {
    id: 'hist-01', cat: 'history', type: 'open',
    q: { zh: '三阶魔方是谁发明的?', en: 'Who invented the 3×3 Rubik\'s Cube?' },
    answer: { zh: '匈牙利人 Ernő Rubik(鲁比克)', en: 'Ernő Rubik, from Hungary' },
    accept: ['鲁比克', 'rubik', 'erno', 'ernő'],
    why: {
      zh: '他是布达佩斯的建筑与设计老师,1974 年做出第一个木头原型,本来是想给学生讲空间结构。',
      en: 'A Budapest teacher of architecture and design, he built the first wooden prototype in 1974 as a way to explain 3D structure to students.',
    },
  },
  {
    id: 'hist-02', cat: 'history', type: 'choice',
    q: { zh: '鲁比克是哪个国家的人?', en: 'Which country is Ernő Rubik from?' },
    options: [
      { zh: '匈牙利', en: 'Hungary' },
      { zh: '波兰', en: 'Poland' },
      { zh: '奥地利', en: 'Austria' },
      { zh: '捷克', en: 'Czechia' },
    ],
    answer: 0,
  },
  {
    id: 'hist-03', cat: 'history', type: 'choice',
    q: { zh: '魔方诞生于哪一年?', en: 'In which year was the cube created?' },
    options: [
      { zh: '1974 年', en: '1974' },
      { zh: '1968 年', en: '1968' },
      { zh: '1980 年', en: '1980' },
      { zh: '1985 年', en: '1985' },
    ],
    answer: 0,
    why: {
      zh: '1974 年做出原型,1975 年在匈牙利申请专利,1977 年才在匈牙利本土上市。',
      en: 'Prototype in 1974, Hungarian patent filed in 1975, first sold in Hungary in 1977.',
    },
  },
  {
    id: 'hist-04', cat: 'history', type: 'choice',
    q: { zh: '鲁比克发明魔方时的本职工作是什么?', en: 'What was Rubik doing for a living when he invented the cube?' },
    options: [
      { zh: '教建筑与设计', en: 'Teaching architecture and design' },
      { zh: '大学数学教授', en: 'University maths professor' },
      { zh: '玩具公司设计师', en: 'Toy-company designer' },
      { zh: '机械工程师', en: 'Mechanical engineer' },
    ],
    answer: 0,
  },
  {
    id: 'hist-05', cat: 'history', type: 'choice',
    q: { zh: '魔方在匈牙利最早叫什么名字?', en: 'What was the cube first called in Hungary?' },
    options: [
      { zh: '魔术方块(Magic Cube)', en: 'Magic Cube (Bűvös kocka)' },
      { zh: '鲁比克方块', en: 'Rubik\'s Cube' },
      { zh: '六色方块', en: 'Six-Colour Cube' },
      { zh: '布达佩斯方块', en: 'Budapest Cube' },
    ],
    answer: 0,
    why: {
      zh: '匈牙利语 Bűvös kocka 就是「魔术方块」;1980 年走向世界时才定名 Rubik\'s Cube。',
      en: 'Hungarian "Bűvös kocka" means Magic Cube. It was renamed Rubik\'s Cube when it went global in 1980.',
    },
  },
  {
    id: 'hist-06', cat: 'history', type: 'choice',
    q: { zh: '第一届魔方世界锦标赛在哪一年举行?', en: 'When was the first Rubik\'s Cube World Championship held?' },
    options: [
      { zh: '1982 年', en: '1982' },
      { zh: '1979 年', en: '1979' },
      { zh: '1990 年', en: '1990' },
      { zh: '2003 年', en: '2003' },
    ],
    answer: 0,
    why: {
      zh: '1982 年在匈牙利布达佩斯,19 个国家参赛,冠军 Minh Thai 成绩 22.95 秒。',
      en: 'Budapest, Hungary, with 19 countries taking part. Minh Thai won with 22.95 seconds.',
    },
  },
  {
    id: 'hist-07', cat: 'history', type: 'open',
    q: { zh: '第一届魔方世界锦标赛在哪座城市举行?', en: 'Which city hosted the first World Championship?' },
    answer: { zh: '匈牙利布达佩斯', en: 'Budapest, Hungary' },
    accept: ['布达佩斯', 'budapest'],
  },
  {
    id: 'hist-08', cat: 'history', type: 'choice',
    q: { zh: '1982 年首届世锦赛的三阶冠军是谁?', en: 'Who won the 3×3 event at the 1982 World Championship?' },
    options: [
      { zh: 'Minh Thai(明泰)', en: 'Minh Thai' },
      { zh: 'Guus Razoux Schultz', en: 'Guus Razoux Schultz' },
      { zh: 'Jessica Fridrich', en: 'Jessica Fridrich' },
      { zh: 'Lars Petrus', en: 'Lars Petrus' },
    ],
    answer: 0,
    why: {
      zh: '当时 16 岁的越南裔美国少年,三次尝试的最好成绩 22.95 秒;亚军 Guus Razoux Schultz 24.32 秒。',
      en: 'A 16-year-old Vietnamese-American, best of three attempts 22.95s. Guus Razoux Schultz was second with 24.32s.',
    },
  },
  {
    id: 'hist-09', cat: 'history', type: 'open',
    q: { zh: 'WCA 这三个字母是什么的缩写?', en: 'What does WCA stand for?' },
    answer: { zh: 'World Cube Association,世界魔方协会', en: 'World Cube Association' },
    accept: ['world cube', '世界魔方'],
  },
  {
    id: 'hist-10', cat: 'history', type: 'choice',
    q: { zh: 'WCA 成立于哪一年?', en: 'In which year was the WCA founded?' },
    options: [
      { zh: '2004 年', en: '2004' },
      { zh: '1982 年', en: '1982' },
      { zh: '1999 年', en: '1999' },
      { zh: '2010 年', en: '2010' },
    ],
    answer: 0,
    why: {
      zh: '由荷兰的 Ron van Bruchem 和美国的 Tyson Mao 等人发起,2004 年正式成立,从此速拧有了统一规则。',
      en: 'Started by Ron van Bruchem (Netherlands) and Tyson Mao (USA) among others — speedcubing finally got one rulebook.',
    },
  },
  {
    id: 'hist-11', cat: 'history', type: 'choice',
    q: { zh: '2003 年世界锦标赛重启,办在哪座城市?', en: 'The World Championship restarted in 2003 — in which city?' },
    options: [
      { zh: '多伦多', en: 'Toronto' },
      { zh: '布达佩斯', en: 'Budapest' },
      { zh: '伦敦', en: 'London' },
      { zh: '东京', en: 'Tokyo' },
    ],
    answer: 0,
    why: {
      zh: '那场比赛是 1982 年之后第一次大规模速拧赛事,也直接催生了 WCA。',
      en: 'It was the first large speedcubing event since 1982, and it led directly to the founding of the WCA.',
    },
  },
  {
    id: 'hist-12', cat: 'history', type: 'choice',
    q: { zh: '「上帝之数」等于 20 是在哪一年被证明的?', en: 'When was God\'s number proven to be 20?' },
    options: [
      { zh: '2010 年', en: '2010' },
      { zh: '1995 年', en: '1995' },
      { zh: '2016 年', en: '2016' },
      { zh: '2021 年', en: '2021' },
    ],
    answer: 0,
    why: {
      zh: '一组研究者借助 Google 的算力穷尽了所有状态,证明任何打乱都能在 20 步内还原。',
      en: 'A team using Google computing power exhausted every state and showed 20 moves always suffice.',
    },
  },
  {
    id: 'hist-13', cat: 'history', type: 'open',
    q: { zh: 'CFOP 常被叫作「某某方法」,是以谁的名字命名的?', en: 'CFOP is often called the "… method", named after whom?' },
    answer: { zh: 'Jessica Fridrich(弗里德里希)', en: 'Jessica Fridrich' },
    accept: ['fridrich', '弗里德里希', '弗里德里奇'],
    why: {
      zh: '她在 1990 年代整理并公开了这套「十字 → F2L → OLL → PLL」的完整体系,所以俗称 Fridrich 方法。',
      en: 'She compiled and published the full cross → F2L → OLL → PLL system in the 1990s.',
    },
  },
  {
    id: 'hist-14', cat: 'history', type: 'choice',
    q: { zh: '下面哪个玩具也是鲁比克设计的?', en: 'Which of these was also designed by Rubik?' },
    options: [
      { zh: '魔尺(Rubik\'s Snake)', en: 'Rubik\'s Snake' },
      { zh: '魔表(Rubik\'s Clock)', en: 'Rubik\'s Clock' },
      { zh: '华容道', en: 'Klotski sliding puzzle' },
      { zh: '孔明锁', en: 'Burr puzzle' },
    ],
    answer: 0,
    why: {
      zh: '魔尺是鲁比克 1981 年的作品;魔表虽然挂着 Rubik\'s 的名字,却是另外两位发明人设计的。',
      en: 'Rubik designed the Snake in 1981. Rubik\'s Clock carries the brand but was invented by two other people.',
    },
  },
];
