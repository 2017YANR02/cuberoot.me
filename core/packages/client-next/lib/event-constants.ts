// Ported from packages/client/src/pages/wca_stats/event_constants.ts.

export const EVENT_NAME_TO_ID: Record<string, string> = {
  "Rubik's Cube": "333",
  "2x2x2 Cube": "222",
  "4x4x4 Cube": "444",
  "5x5x5 Cube": "555",
  "6x6x6 Cube": "666",
  "7x7x7 Cube": "777",
  "3x3x3 Blindfolded": "333bf",
  "3x3x3 Fewest Moves": "333fm",
  "3x3x3 One-Handed": "333oh",
  "Megaminx": "minx",
  "Pyraminx": "pyram",
  "Rubik's Clock": "clock",
  "Skewb": "skewb",
  "Square-1": "sq1",
  "4x4x4 Blindfolded": "444bf",
  "5x5x5 Blindfolded": "555bf",
  "3x3x3 Multi-Blind": "333mbf",
  "3x3x3 With Feet": "333ft",
  "Rubik's Magic": "magic",
  "Master Magic": "mmagic",
  "Rubik's Cube: Multiple blind old style": "333mbo",
};

export const ALL_EVENT_IDS: string[] = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', 'minx', 'pyram', 'clock',
  'skewb', 'sq1', '444bf', '555bf', '333mbf',
  '333ft', 'magic', 'mmagic', '333mbo',
];

export const EVENT_ZH: Record<string, string> = {
  "333": "三阶魔方", "222": "二阶魔方", "444": "四阶魔方",
  "555": "五阶魔方", "666": "六阶魔方", "777": "七阶魔方",
  "333bf": "三阶盲拧", "333fm": "三阶最少步", "333oh": "三阶单手",
  "minx": "五魔方", "pyram": "金字塔", "clock": "魔表",
  "skewb": "斜转魔方", "sq1": "SQ1", "444bf": "四阶盲拧",
  "555bf": "五阶盲拧", "333mbf": "三阶多盲", "333ft": "三阶脚拧",
  "magic": "八板", "mmagic": "十二板", "333mbo": "旧多盲",
};

export const EVENT_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EVENT_NAME_TO_ID).map(([name, id]) => [id, name]),
);
