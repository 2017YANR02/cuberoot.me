// NOTE: WCA 项目映射 + 中英文翻译
// 与 Ruby _stats_build/core/events.rb 1:1 对应

export const EVENTS: Record<string, string> = {
  '333':    "Rubik's Cube",
  '222':    '2x2x2 Cube',
  '444':    '4x4x4 Cube',
  '555':    '5x5x5 Cube',
  '666':    '6x6x6 Cube',
  '777':    '7x7x7 Cube',
  '333bf':  '3x3x3 Blindfolded',
  '333fm':  '3x3x3 Fewest Moves',
  '333oh':  '3x3x3 One-Handed',
  'minx':   'Megaminx',
  'pyram':  'Pyraminx',
  'clock':  "Rubik's Clock",
  'skewb':  'Skewb',
  'sq1':    'Square-1',
  '444bf':  '4x4x4 Blindfolded',
  '555bf':  '5x5x5 Blindfolded',
  '333mbf': '3x3x3 Multi-Blind',
  '333ft':  '3x3x3 With Feet',
  'magic':  "Rubik's Magic",
  'mmagic': 'Master Magic',
  '333mbo': 'Rubik\'s Cube: Multiple blind old style',
};

// NOTE: 英文名 → 中文名
export const NAMES_ZH: Record<string, string> = {
  "Rubik's Cube":       '三阶魔方',
  '2x2x2 Cube':         '二阶魔方',
  '4x4x4 Cube':         '四阶魔方',
  '5x5x5 Cube':         '五阶魔方',
  '6x6x6 Cube':         '六阶魔方',
  '7x7x7 Cube':         '七阶魔方',
  '3x3x3 Blindfolded':  '三盲',
  '3x3x3 Fewest Moves': '最少步',
  '3x3x3 One-Handed':   '三阶单手',
  'Megaminx':            '五魔',
  'Pyraminx':            '金字塔',
  "Rubik's Clock":       '魔表',
  'Skewb':               '斜转',
  'Square-1':            'SQ1',
  '4x4x4 Blindfolded':  '四盲',
  '5x5x5 Blindfolded':  '五盲',
  '3x3x3 Multi-Blind':  '多盲',
  '3x3x3 With Feet':    '三阶脚拧',
  "Rubik's Magic":       '八板',
  'Master Magic':        '十二板',
  'Rubik\'s Cube: Multiple blind old style': '旧多盲',
};

// NOTE: 表头英文 → 中文映射
export const HEADER_ZH: Record<string, string> = {
  'Person': '选手',
  'Event': '项目',
  'Count': '次数',
  'Competition': '比赛',
  'Competitions': '比赛',
  'Date': '日期',
  'Country': '国家',
  'Rank': '排名',
  'Result': '成绩',
  'Details': '详情',
  'Gain': '提升',
  'Days': '天数',
  'Records': '纪录数',
  'Gold': '金牌',
  'Silver': '银牌',
  'Bronze': '铜牌',
  'Total': '总计',
  'WRs': '世界纪录数',
  'People': '选手',
};

export function eventZh(name: string): string {
  return NAMES_ZH[name] ?? name;
}

export function headerZh(name: string): string {
  return HEADER_ZH[name] ?? name;
}
