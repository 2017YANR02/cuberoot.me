import DAYS from '../timeline_commits.json';

function historyDay(date: string) {
  const day = DAYS.findIndex(entry => entry.date === date);
  if (day < 0) throw new Error(`History secret has no recorded date: ${date}`);
  return day;
}

// Keep this registry independent of Three.js: the journey controls render before the scene loads.
const secrets = [
  {
    id: 'laurel-cup', date: '2026-02-17', href: '/wca',
    zh: '藏在桂叶间的奖杯', en: 'The laurel cup',
    description: {
      zh: '小小纸杯，装着世界各地的速拧成绩。去 WCA 统计看看选手与纪录。',
      en: 'A tiny paper cup holds results from around the world. Explore cubers and records in WCA statistics.',
    },
  },
  {
    id: 'turning-gyroscope', date: '2026-05-19', href: '/sim',
    zh: '指尖的回旋', en: 'A turn at your fingertips',
    description: {
      zh: '三道细环，藏着转动的乐趣。打开模拟器，亲手转一转不同的魔方。',
      en: 'Three slender rings invite a turn. Open the simulator and explore different twisty puzzles.',
    },
  },
  {
    id: 'ribbon-book', date: '2026-06-16', href: '/alg/3x3',
    zh: '书签留住的一页', en: 'A page kept by a ribbon',
    description: {
      zh: '折起的书页里，藏着下一步。翻开三阶公式库，查看案例与转动演示。',
      en: 'A folded page holds the next move. Browse 3×3 cases and move demonstrations in the algorithm library.',
    },
  },
  {
    id: 'sealed-letter', date: '2026-07-09', href: '/forum',
    zh: '河岸边的一封信', en: 'A letter by the river',
    description: {
      zh: '一枚封蜡，连着画卷之外的声音。到社区读读大家分享的故事与讨论。',
      en: 'A wax seal carries voices beyond the scroll. Read stories and discussions from the community.',
    },
  },
  {
    id: 'paper-gramophone', date: '2026-09-02', href: '/music',
    zh: '芦苇里的留声机', en: 'A gramophone in the reeds',
    description: {
      zh: '唱针落下，旅途有了旋律。打开音乐页，挑一首歌陪你继续漫游。',
      en: 'The needle drops and the journey gains a melody. Choose a song from the music page for your next stroll.',
    },
  },
  {
    id: 'star-lantern', date: '2026-09-05', href: '/space',
    zh: '把星光提在手里', en: 'A little lantern of stars',
    description: {
      zh: '提起这盏星灯，走进另一片天地。在三维空间里自由摆放魔方、观察场景。',
      en: 'Lift this star lantern into another world. Arrange cubes and explore the scene in the 3D space.',
    },
  },
] as const;

export const HISTORY_SECRETS = secrets.map(secret => ({ ...secret, day: historyDay(secret.date) }));
export type HistorySecret = (typeof HISTORY_SECRETS)[number];
